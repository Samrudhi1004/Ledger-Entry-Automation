import io
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from apps.document_control.models import Document, DocumentChangeRequest, DCRNotification

User = get_user_model()

class DocumentControlSystemTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Users
        self.admin = User.objects.create_user(
            username='admin_user',
            password='password123',
            role='admin',
            first_name='Admin',
            last_name='User',
            email='admin@example.com'
        )
        self.supervisor = User.objects.create_user(
            username='supervisor_user',
            password='password123',
            role='supervisor',
            first_name='Supervisor',
            last_name='User',
            email='supervisor@example.com'
        )
        self.calibrator = User.objects.create_user(
            username='calibrator_user',
            password='password123',
            role='calibrator',
            first_name='Calibrator',
            last_name='User',
            email='calibrator@example.com'
        )
        self.operator = User.objects.create_user(
            username='operator_user',
            password='password123',
            role='operator',
            first_name='Operator',
            last_name='User',
            email='operator@example.com'
        )
        self.inspector = User.objects.create_user(
            username='inspector_user',
            password='password123',
            role='quality_engineer',
            first_name='Inspector',
            last_name='User',
            email='inspector@example.com'
        )

        self.doc_l1 = Document.objects.create(
            document_number='MANUAL-01',
            title='Quality Manual',
            doc_level='L1',
            revision='Rev A',
            status='approved',
            uploaded_by=self.admin
        )
        self.doc_l2 = Document.objects.create(
            document_number='SOP-MCH-01',
            title='CNC Machine Setup SOP',
            doc_level='L2',
            revision='Rev A',
            status='approved',
            uploaded_by=self.supervisor
        )
        self.doc_l3 = Document.objects.create(
            document_number='WI-QC-05',
            title='Vernier Caliper Work Instruction',
            doc_level='L3',
            revision='Rev B',
            status='approved',
            uploaded_by=self.calibrator
        )
        self.doc_l4 = Document.objects.create(
            document_number='DKI/MR/F/05',
            title='Document Change Request Form',
            doc_level='L4',
            revision='Rev 01',
            status='approved',
            uploaded_by=self.admin
        )

    def test_level_filtering(self):
        """Verify ?level=L1/L2/L3/L4 filters work accurately."""
        self.client.force_authenticate(user=self.supervisor)

        # Test L1
        res = self.client.get('/api/document-control/documents/?level=L1')
        self.assertEqual(res.status_code, 200)
        docs = res.data if isinstance(res.data, list) else res.data.get('results', [])
        self.assertEqual(len(docs), 1)
        self.assertEqual(docs[0]['document_number'], 'QM-001')

        # Test L3
        res = self.client.get('/api/document-control/documents/?level=L3')
        self.assertEqual(res.status_code, 200)
        docs = res.data if isinstance(res.data, list) else res.data.get('results', [])
        self.assertEqual(len(docs), 1)
        self.assertEqual(docs[0]['document_number'], 'WI-QC-05')

    def test_role_restrictions_on_dcr_submission(self):
        """Operators and inspectors are strictly blocked from submitting DCRs."""
        # 1. Operator attempts DCR -> 403 Forbidden
        self.client.force_authenticate(user=self.operator)
        res = self.client.post('/api/document-control/change-requests/submit/', {
            'document_id': str(self.doc_l2.id),
            'change_type': 'modification',
            'reason_for_change': 'Operator wants change',
            'existing_revision': 'Rev A',
            'proposed_revision': 'Rev B',
            'reviewer_id': self.supervisor.id,
            'approver_id': self.admin.id,
        })
        self.assertEqual(res.status_code, 403)
        self.assertIn('Operators and Inspectors', res.data.get('error', ''))

        # 2. Quality Engineer (Inspector) attempts DCR -> 403 Forbidden
        self.client.force_authenticate(user=self.inspector)
        res = self.client.post('/api/document-control/change-requests/submit/', {
            'document_id': str(self.doc_l2.id),
            'change_type': 'modification',
            'reason_for_change': 'Inspector wants change',
            'existing_revision': 'Rev A',
            'proposed_revision': 'Rev B',
            'reviewer_id': self.supervisor.id,
            'approver_id': self.admin.id,
        })
        self.assertEqual(res.status_code, 403)

    def test_complete_dcr_workflow(self):
        """Supervisor submits DCR -> Supervisor reviews & approves -> Admin approves -> Doc revision updated."""
        # Step 1: Supervisor submits DCR
        self.client.force_authenticate(user=self.supervisor)
        res = self.client.post('/api/document-control/change-requests/submit/', {
            'document_id': str(self.doc_l2.id),
            'change_type': 'modification',
            'reason_for_change': 'Updated tooling specs',
            'nature_of_change': 'Modified table in section 3.1',
            'existing_revision': 'Rev A',
            'proposed_revision': 'Rev B',
            'reviewer_id': self.supervisor.id,
            'calibrator_id': self.calibrator.id,
            'approver_id': self.admin.id,
        })
        self.assertEqual(res.status_code, 201)
        dcr_id = res.data['id']
        dcr_number = res.data['dcr_number']
        self.assertTrue(dcr_number.startswith('DCR-'))
        self.assertEqual(res.data['status'], 'awaiting_review')

        # Check Reviewer received in-app notification
        review_notif = DCRNotification.objects.filter(recipient=self.supervisor, dcr_id=dcr_id).first()
        self.assertIsNotNone(review_notif)
        self.assertIn('review', review_notif.title.lower())

        # Step 2: Reviewer reviews and approves
        res = self.client.post(f'/api/document-control/change-requests/{dcr_id}/submit_review/', {
            'comments': 'Tooling changes verified and feasible.'
        })
        self.assertEqual(res.status_code, 200)
        dcr = DocumentChangeRequest.objects.get(id=dcr_id)
        self.assertEqual(dcr.status, 'awaiting_approval')
        self.assertEqual(dcr.review_remark, 'Tooling changes verified and feasible.')

        # Check Approver received in-app notification
        admin_notif = DCRNotification.objects.filter(recipient=self.admin, dcr_id=dcr_id).first()
        self.assertIsNotNone(admin_notif)
        self.assertIn('approval', admin_notif.title.lower())

        # Step 3: Admin approves DCR
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(f'/api/document-control/change-requests/{dcr_id}/approve/', {
            'comments': 'Approved for release as Rev B.'
        })
        self.assertEqual(res.status_code, 200)
        dcr.refresh_from_db()
        self.assertEqual(dcr.status, 'approved')
        self.assertEqual(dcr.mr_remarks, 'Approved for release as Rev B.')

        # Target document is verified approved
        self.doc_l2.refresh_from_db()
        self.assertEqual(self.doc_l2.status, 'approved')

        # Step 4: PDF Export test
        res = self.client.get(f'/api/document-control/change-requests/{dcr_id}/pdf/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Type'], 'application/pdf')
        self.assertIn(f'filename="{dcr_number}.pdf"', res['Content-Disposition'])
        self.assertTrue(len(res.content) > 1000) # Valid PDF bytes

    def test_dcr_review_rejection_workflow(self):
        """Reviewer rejects DCR -> status becomes rejected, requestor notified, approver bypassed."""
        self.client.force_authenticate(user=self.supervisor)
        res = self.client.post('/api/document-control/change-requests/submit/', {
            'document_id': str(self.doc_l3.id),
            'change_type': 'deletion',
            'reason_for_change': 'Obsolete step',
            'existing_revision': 'Rev B',
            'proposed_revision': 'Rev C',
            'reviewer_id': self.supervisor.id,
            'approver_id': self.admin.id,
        })
        dcr_id = res.data['id']

        # Reviewer rejects
        res = self.client.post(f'/api/document-control/change-requests/{dcr_id}/reject_review/', {
            'rejected_reason': 'Step cannot be deleted as it is required by customer audit.'
        })
        self.assertEqual(res.status_code, 200)
        dcr = DocumentChangeRequest.objects.get(id=dcr_id)
        self.assertEqual(dcr.status, 'rejected')
        self.assertEqual(dcr.rejection_stage, 'review')
        self.assertIn('required by customer audit', dcr.rejection_reason)

        # Requestor should have received rejection notification
        notif = DCRNotification.objects.filter(
            recipient=self.supervisor,
            action_type=DCRNotification.ActionType.DCR_REJECTED
        ).first()
        self.assertIsNotNone(notif)
        self.assertIn('rejected', notif.title.lower())
