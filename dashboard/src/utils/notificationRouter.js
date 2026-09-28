/**
 * Utility to resolve notification objects to clean, SPA-friendly relative routes
 * with all entity IDs preserved for auto-opening (DCRs, Documents, Messages, Parameters, etc.)
 */

export const resolveNotificationUrl = (notif) => {
  if (!notif) return '/';

  // 1. Sanitize raw action_url by stripping domain/protocol if present
  let rawUrl = (notif.action_url || '').trim();
  if (rawUrl) {
    try {
      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        const parsed = new URL(rawUrl);
        rawUrl = parsed.pathname + parsed.search + parsed.hash;
      }
    } catch {
      // Fallback: strip leading domain pattern manually if URL parsing fails
      rawUrl = rawUrl.replace(/^https?:\/\/[^/]+/i, '');
    }
  }

  // 2. Messages module notification
  const convId = notif.conversation_id || notif.conversation;
  if (convId || rawUrl.startsWith('/messages')) {
    if (convId && !rawUrl.includes('conversation=')) {
      return `/messages?conversation=${convId}`;
    }
    return rawUrl || '/messages';
  }

  // 3. Document Change Requests (DCRs)
  const isDcrType = notif.action_type && (
    notif.action_type.includes('dcr') ||
    notif.action_type === 'review_requested' ||
    notif.action_type === 'approval_requested'
  );

  // If specific DCR ID is present
  if (notif.dcr) {
    const tab = (notif.action_type === 'dcr_approved' || notif.action_type === 'dcr_rejected')
      ? 'my_requests'
      : 'action_required';
    return `/document-control/dcr?tab=${tab}&dcr=${notif.dcr}`;
  }

  // If action_url pointed to generic /document-control or DCR type without ID
  if (rawUrl === '/document-control' || rawUrl === '/document-control/' || (isDcrType && !rawUrl.includes('/documents'))) {
    return `/document-control/dcr?tab=action_required`;
  }

  // 4. Controlled Documents (L1-L4)
  if (notif.document) {
    return `/document-control/documents?preview=${notif.document}`;
  }
  if (notif.action_type && notif.action_type.startsWith('DOC_')) {
    return rawUrl || '/document-control/documents';
  }

  // 5. Preserved relative URL for other modules (e.g., /parameters, /development/drawings, /development/control-plans, /tasks)
  if (rawUrl) {
    return rawUrl;
  }

  // 6. Universal default fallback
  return '/document-control/dcr?tab=action_required';
};
