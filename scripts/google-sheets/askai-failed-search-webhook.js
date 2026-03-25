/*
Google Apps Script Web App endpoint for AskAI weekly aggregate payloads.

How to use:
1. Create a Google Sheet and copy its ID from the URL.
2. In script editor, paste this file and set SHEET_ID + TAB_NAME.
3. Deploy as Web app:
   - Execute as: Me
   - Who has access: Anyone with the link
4. Copy the /exec URL and paste it into /ask-ai-insights webhook URL field.

Expected payload shape:
{
  eventType: 'askai_failed_search_weekly_aggregate',
  generatedAt: 'ISO timestamp',
  rowCount: number,
  rows: [
    {
      weekStart,
      exactQuery,
      normalizedQuery,
      countFailures,
      closestReturnedPage,
      confidenceAverage,
      signals,
      reasons,
      lastSeenAt
    }
  ]
}
*/

const SHEET_ID = 'PASTE_YOUR_GOOGLE_SHEET_ID';
const TAB_NAME = 'AskAI Weekly Gaps';

function ensureHeader(sheet) {
  const headers = [
    'received_at',
    'week_start',
    'exact_query',
    'normalized_query',
    'count_failures',
    'closest_returned_page',
    'confidence_average',
    'signals',
    'reasons_json',
    'last_seen_at',
  ];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const rows = Array.isArray(payload.rows) ? payload.rows : [];

    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(TAB_NAME) || spreadsheet.insertSheet(TAB_NAME);
    ensureHeader(sheet);

    const receivedAt = new Date().toISOString();
    const values = rows.map((row) => [
      receivedAt,
      row.weekStart || '',
      row.exactQuery || '',
      row.normalizedQuery || '',
      Number(row.countFailures || 0),
      row.closestReturnedPage || '',
      Number(row.confidenceAverage || 0),
      Array.isArray(row.signals) ? row.signals.join('; ') : '',
      JSON.stringify(row.reasons || {}),
      row.lastSeenAt || '',
    ]);

    if (values.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ok: true, rowsWritten: values.length}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ok: false, error: String(error)}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
