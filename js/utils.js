/*!
 * AgentFlow
 * Copyright (c) 2026 Visigence. All rights reserved.
 * Proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use is prohibited.
 */
'use strict';



function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}