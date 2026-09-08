"""
Models for Parts, Inspection Templates, and Parameters with Tolerances.
This is the core master data that drives the entire inspection workflow.
"""

from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator


class Part(models.Model):
    """A manufactured part — identified by part number."""

    machine     = models.ForeignKey(
        'machines.Machine',
        on_delete=models.CASCADE,
        related_name='parts',
    )
    part_number = models.CharField(max_length=50, unique=True)  # e.g. PN-001
    part_name   = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    drawing_number = models.CharField(max_length=50, blank=True)
    revision    = models.CharField(max_length=10, blank=True, default='A')
    is_active   = models.BooleanField(default=True)
    created_by  = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_parts',
    )
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'parts'
        ordering = ['part_number']

    def __str__(self):
        return f"{self.part_number} — {self.part_name}"


class InspectionTemplate(models.Model):
    """
    A versioned inspection template for a part.
    Defines which parameters must be measured and for which inspection types.
    """

    class InspectionType(models.TextChoices):
        FIRST_PIECE = 'first_piece', 'First Piece'
        HOURLY      = 'hourly',      'Hourly'
        FINAL       = 'final',       'Final'

    part            = models.ForeignKey(Part, on_delete=models.CASCADE, related_name='templates')
    name            = models.CharField(max_length=150, blank=True, default='', help_text='Custom Operation Name e.g. Op 10 - Rough Turning')
    inspection_type = models.CharField(max_length=20, choices=InspectionType.choices)
    version         = models.PositiveIntegerField(default=1)
    target_parameter_count = models.PositiveIntegerField(
        default=10,
        help_text='Expected total parameter count configured by supervisor (e.g. 18, 10, 4)'
    )
    is_active       = models.BooleanField(default=True)
    is_published    = models.BooleanField(default=True, help_text='Dispatched and live for operators and inspectors on mobile')
    published_at    = models.DateTimeField(null=True, blank=True)
    cycle_time_mins = models.FloatField(default=0.0, help_text='Cycle time per operation in minutes')
    created_by      = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_templates',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table        = 'inspection_templates'
        ordering        = ['part', 'inspection_type', '-version']
        # Only one active template per part + inspection type
        unique_together = [('part', 'inspection_type', 'version')]

    def __str__(self):
        op_label = self.name if self.name else self.get_inspection_type_display()
        return f"{self.part.part_number} — {op_label} v{self.version} ({self.configured_parameter_count}/{self.target_parameter_count})"

    @property
    def configured_parameter_count(self):
        return self.parameters.count()

    @property
    def is_configuration_complete(self):
        return self.configured_parameter_count >= self.target_parameter_count


class InspectionParameter(models.Model):
    """
    A single measurable parameter in an inspection template.
    Stores nominal value and tolerances for validation.
    """

    class MeasurementType(models.TextChoices):
        DIMENSIONAL = 'dimensional', 'Dimensional'
        VISUAL      = 'visual',      'Visual'
        WEIGHT      = 'weight',      'Weight'
        SURFACE     = 'surface',     'Surface Finish'
        MIN_LIMIT   = 'min_limit',   'Min Limit'
        MAX_LIMIT   = 'max_limit',   'Max Limit'

    template        = models.ForeignKey(
        InspectionTemplate,
        on_delete=models.CASCADE,
        related_name='parameters',
    )
    parameter_name  = models.CharField(max_length=150)  # e.g. "Bore Diameter"
    parameter_code  = models.CharField(max_length=30, blank=True, default='')   # e.g. "P1"
    unit            = models.CharField(max_length=20)   # e.g. "mm", "inch", "kg"

    # Tolerance specification
    nominal_value   = models.DecimalField(max_digits=12, decimal_places=4)
    upper_tolerance = models.DecimalField(max_digits=10, decimal_places=4)  # e.g. +0.02
    lower_tolerance = models.DecimalField(max_digits=10, decimal_places=4)  # e.g. -0.02

    # Computed limits (auto-calculated on save)
    upper_limit     = models.DecimalField(max_digits=12, decimal_places=4, editable=False)
    lower_limit     = models.DecimalField(max_digits=12, decimal_places=4, editable=False)

    measurement_type = models.CharField(
        max_length=20,
        choices=MeasurementType.choices,
        default=MeasurementType.DIMENSIONAL,
    )

    # If True, out-of-spec triggers immediate supervisor alert
    is_critical     = models.BooleanField(default=False)

    # Display order on the Flutter app screen
    sequence_order  = models.PositiveIntegerField(default=1)

    # Control Plan specifications
    measurement_technique = models.CharField(max_length=100, blank=True, default='')
    sample_size           = models.CharField(max_length=100, blank=True, default='')
    control_method        = models.CharField(max_length=100, blank=True, default='')

    # Optional voice hint shown to operator before recording
    voice_prompt    = models.CharField(
        max_length=200,
        blank=True,
        help_text='e.g. "Please say the bore diameter measurement"',
    )

    class Meta:
        db_table = 'inspection_parameters'
        ordering = ['sequence_order']

    def __str__(self):
        return f"{self.parameter_code}: {self.parameter_name} ({self.nominal_value} {self.unit})"

    def save(self, *args, **kwargs):
        if not self.parameter_code:
            self.parameter_code = f"P{self.sequence_order or 1}"

        # Ensure Decimal types for calculation
        nom = Decimal(str(self.nominal_value or '0'))
        upper_tol = Decimal(str(self.upper_tolerance or '0'))
        lower_tol = Decimal(str(self.lower_tolerance or '0'))

        # Auto-compute upper and lower limits based on inspection rule
        mtype = (self.measurement_type or '').lower()
        if mtype == 'min_limit':
            self.upper_limit = Decimal('99999.0000')
            self.lower_limit = nom
        elif mtype in ['max_limit', 'surface']:
            self.upper_limit = nom
            self.lower_limit = Decimal('0.0000')
        elif mtype == 'visual':
            self.upper_limit = Decimal('1.0000')
            self.lower_limit = Decimal('0.0000')
        else:
            self.upper_limit = nom + upper_tol
            self.lower_limit = nom + lower_tol
        super().save(*args, **kwargs)

    @property
    def tolerance_range(self):
        return f"{self.nominal_value}{self.unit} +{self.upper_tolerance}/{self.lower_tolerance}"


class ProcessParameter(models.Model):
    """
    A process/setup parameter checked by Inspector during Setup Approval (1PC#1, 1PC#2, 1PC#3).
    Examples: RPM, Feed, Tool Number, Tool Offset, Coolant, Fixture Condition.
    NOT applicable to hourly inspections (1HR - 8HR).
    """

    class DataType(models.TextChoices):
        NUMERIC   = 'numeric',   'Numeric'
        TEXT      = 'text',      'Text'
        YES_NO    = 'yes_no',    'Yes / No'
        SELECTION = 'selection', 'Selection'

    class MeasurementType(models.TextChoices):
        DIMENSIONAL = 'dimensional', 'Dimensional'
        VISUAL      = 'visual',      'Visual'
        WEIGHT      = 'weight',      'Weight'
        SURFACE     = 'surface',     'Surface Finish'
        MIN_LIMIT   = 'min_limit',   'Min Limit'
        MAX_LIMIT   = 'max_limit',   'Max Limit'

    template        = models.ForeignKey(
        InspectionTemplate,
        on_delete=models.CASCADE,
        related_name='process_parameters',
    )
    parameter_name  = models.CharField(max_length=150)  # e.g. "RPM", "Feed", "Tool Number", "Coolant"
    parameter_code  = models.CharField(max_length=30, blank=True, default='')   # e.g. "PR1"
    description     = models.TextField(blank=True, default='')
    data_type       = models.CharField(
        max_length=20,
        choices=DataType.choices,
        default=DataType.NUMERIC,
    )
    measurement_type = models.CharField(
        max_length=20,
        choices=MeasurementType.choices,
        default=MeasurementType.DIMENSIONAL,
        blank=True,
        help_text='Controls how upper/lower limits are computed for numeric parameters.',
    )
    unit            = models.CharField(max_length=20, blank=True, default='')   # e.g. "RPM", "mm/rev", "°C"

    # Specification / Expected value
    specification   = models.CharField(max_length=150, blank=True, default='')  # e.g. "1200", "0.25", "T05", "YES"

    # Numeric tolerances (optional for numeric data_type)
    nominal_value   = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    upper_tolerance = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    lower_tolerance = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    upper_limit     = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    lower_limit     = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)

    is_required     = models.BooleanField(default=True)
    is_active       = models.BooleanField(default=True)
    sequence_order  = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = 'process_parameters'
        ordering = ['sequence_order']

    def __str__(self):
        return f"{self.parameter_code}: {self.parameter_name} ({self.get_data_type_display()})"

    def save(self, *args, **kwargs):
        if not self.parameter_code:
            self.parameter_code = f"PR{self.sequence_order or 1}"

        if self.data_type == self.DataType.NUMERIC and self.nominal_value is not None:
            nom = Decimal(str(self.nominal_value or '0'))
            upper_tol = Decimal(str(self.upper_tolerance or '0'))
            lower_tol = Decimal(str(self.lower_tolerance or '0'))

            # Apply the same 3 limit-computation rules as InspectionParameter
            mtype = (self.measurement_type or '').lower()
            if mtype == 'min_limit':
                # Value must be >= nominal; no upper bound
                self.upper_limit = Decimal('99999.0000')
                self.lower_limit = nom
            elif mtype in ['max_limit', 'surface']:
                # Value must be <= nominal; lower bound is 0
                self.upper_limit = nom
                self.lower_limit = Decimal('0.0000')
            elif mtype == 'visual':
                # Binary pass/fail: 1 = OK, 0 = Fail
                self.upper_limit = Decimal('1.0000')
                self.lower_limit = Decimal('0.0000')
            else:
                # Default (dimensional, weight, etc.): nominal ± tolerance
                self.upper_limit = nom + upper_tol
                self.lower_limit = nom + lower_tol
        super().save(*args, **kwargs)


class DrawingDocument(models.Model):
    """
    An Engineering Drawing record.
    Can optionally be linked to a Part, or kept as a general drawing.
    Holds metadata and tracks its revision history via DrawingVersion.
    """
    part = models.ForeignKey(
        Part,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='drawings',
        help_text='Optional link to a Part'
    )
    drawing_number = models.CharField(max_length=100, unique=True, help_text='Unique Drawing Number e.g. DWG-101')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    current_revision = models.CharField(max_length=20, default='Rev A')
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_drawings',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'drawing_documents'
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.drawing_number} - {self.title} ({self.current_revision})"


class DrawingVersion(models.Model):
    """
    Historical upload version for a Drawing.
    Every upload creates a new version entry storing file, revision code, notes, and timestamp.
    """
    drawing = models.ForeignKey(
        DrawingDocument,
        on_delete=models.CASCADE,
        related_name='versions',
    )
    revision_code = models.CharField(max_length=20)  # e.g. Rev A, Rev B, v1.0
    file = models.FileField(upload_to='drawings/')
    file_name = models.CharField(max_length=255, blank=True)
    file_size = models.PositiveIntegerField(default=0)  # in bytes
    change_notes = models.TextField(blank=True, default='')
    uploaded_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_drawing_versions',
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'drawing_versions'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.drawing.drawing_number} [{self.revision_code}]"

    def save(self, *args, **kwargs):
        if self.file and not self.file_name:
            self.file_name = self.file.name.split('/')[-1]
        if self.file and hasattr(self.file, 'size'):
            self.file_size = getattr(self.file, 'size', 0)
        super().save(*args, **kwargs)


class ControlPlanDocument(models.Model):
    """
    A Process Control Plan record.
    Can optionally be linked to a Part, or kept as a general control plan.
    Holds metadata and tracks version history via ControlPlanVersion.
    """
    part = models.ForeignKey(
        Part,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='control_plans',
        help_text='Optional link to a Part'
    )
    control_plan_number = models.CharField(max_length=100, unique=True, help_text='Unique Control Plan Number e.g. CP-101')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    current_revision = models.CharField(max_length=20, default='v1.0')
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_control_plans',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'control_plan_documents'
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.control_plan_number} - {self.title} ({self.current_revision})"


class ControlPlanVersion(models.Model):
    """
    Historical upload version for a Control Plan.
    """
    control_plan = models.ForeignKey(
        ControlPlanDocument,
        on_delete=models.CASCADE,
        related_name='versions',
    )
    revision_code = models.CharField(max_length=20)  # e.g. v1.0, v1.1
    file = models.FileField(upload_to='control_plans/')
    file_name = models.CharField(max_length=255, blank=True)
    file_size = models.PositiveIntegerField(default=0)
    change_notes = models.TextField(blank=True, default='')
    uploaded_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_control_plan_versions',
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'control_plan_versions'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.control_plan.control_plan_number} [{self.revision_code}]"

    def save(self, *args, **kwargs):
        if self.file and not self.file_name:
            self.file_name = self.file.name.split('/')[-1]
        if self.file and hasattr(self.file, 'size'):
            self.file_size = getattr(self.file, 'size', 0)
        super().save(*args, **kwargs)

