"""
Models for Parts, Inspection Templates, and Parameters with Tolerances.
This is the core master data that drives the entire inspection workflow.
"""

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
    inspection_type = models.CharField(max_length=20, choices=InspectionType.choices)
    version         = models.PositiveIntegerField(default=1)
    is_active       = models.BooleanField(default=True)
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
        return f"{self.part.part_number} — {self.get_inspection_type_display()} v{self.version}"


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

    template        = models.ForeignKey(
        InspectionTemplate,
        on_delete=models.CASCADE,
        related_name='parameters',
    )
    parameter_name  = models.CharField(max_length=150)  # e.g. "Bore Diameter"
    parameter_code  = models.CharField(max_length=30)   # e.g. "BD-01"
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
        # Auto-compute upper and lower limits
        self.upper_limit = self.nominal_value + self.upper_tolerance
        self.lower_limit = self.nominal_value + self.lower_tolerance  # lower_tolerance is negative
        super().save(*args, **kwargs)

    @property
    def tolerance_range(self):
        return f"{self.nominal_value}{self.unit} +{self.upper_tolerance}/{self.lower_tolerance}"
