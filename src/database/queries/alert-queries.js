const { pool } = require('../database');

// --- Price Alerts ---

async function createPriceAlert(userId, symbol, price, condition, alertType = 'PRICE', targetPercentage = null) {
  const sql = `
    INSERT INTO price_alerts(user_id, symbol, target_price, alert_condition, alert_type, target_percentage)
    VALUES(?, ?, ?, ?, ?, ?)
      `;
  // MySQL2 requires null instead of undefined for bind parameters
  const [result] = await pool.execute(sql, [
    userId,
    symbol,
    price ?? null,
    condition,
    alertType,
    targetPercentage ?? null
  ]);
  return result.insertId;
}

async function getUserPriceAlerts(userId) {
  const sql = `
    SELECT * FROM price_alerts 
    WHERE user_id = ?
      ORDER BY created_at DESC
        `;
  const [rows] = await pool.execute(sql, [userId]);
  return rows;
}

async function updatePriceAlert(alertId, userId, data) {
  const { price, condition, is_active, alert_type, target_percentage } = data;
  const updates = [];
  const params = [];

  if (price !== undefined) {
    updates.push('target_price = ?');
    params.push(price);
  }
  if (condition !== undefined) {
    updates.push('alert_condition = ?');
    params.push(condition);
  }
  if (alert_type !== undefined) {
    updates.push('alert_type = ?');
    params.push(alert_type);
  }
  if (target_percentage !== undefined) {
    updates.push('target_percentage = ?');
    params.push(target_percentage);
  }
  if (is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(is_active);
    if (is_active) {
      updates.push('triggered_at = NULL');
      updates.push("last_state = 'NOT_MET'");
    }
  }

  if (updates.length === 0) return true;

  params.push(alertId, userId);
  const sql = `
    UPDATE price_alerts 
    SET ${updates.join(', ')} 
    WHERE id = ? AND user_id = ?
      `;
  const [result] = await pool.execute(sql, params);
  return result.affectedRows > 0;
}

async function deletePriceAlert(alertId, userId) {
  const sql = 'DELETE FROM price_alerts WHERE id = ? AND user_id = ?';
  const [result] = await pool.execute(sql, [alertId, userId]);
  return result.affectedRows > 0;
}

async function getActivePriceAlerts() {
  const sql = `
    SELECT pa.*, nt.fcm_token 
    FROM price_alerts pa
    JOIN notification_tokens nt ON nt.user_id = pa.user_id
    WHERE pa.is_active = TRUE
      `;
  const [rows] = await pool.execute(sql);
  return rows;
}

async function markAlertTriggered(alertId) {
  const sql = `
    UPDATE price_alerts 
    SET triggered_at = CURRENT_TIMESTAMP, last_state = 'MET' 
    WHERE id = ?
      `;
  await pool.execute(sql, [alertId]);
}

async function updateAlertState(alertId, state) {
  const sql = 'UPDATE price_alerts SET last_state = ? WHERE id = ?';
  await pool.execute(sql, [state, alertId]);
}

/**
 * Calculates current WACC for a user across all portfolios for a symbol
 */
async function getUserHoldingWACC(userId, symbol) {
  const sql = `
    SELECT
    SUM(CASE WHEN type IN('SECONDARY_BUY', 'IPO', 'FPO', 'AUCTION', 'RIGHTS', 'BONUS') THEN quantity ELSE 0 END) as total_qty,
      SUM(CASE WHEN type IN('SECONDARY_SELL') THEN quantity ELSE 0 END) as sell_qty,
      SUM(CASE WHEN type IN('SECONDARY_BUY', 'IPO', 'FPO', 'AUCTION', 'RIGHTS', 'BONUS') THEN quantity * price ELSE 0 END) as total_cost
    FROM transactions t
    JOIN portfolios p ON p.id = t.portfolio_id
    WHERE p.user_id = ? AND t.stock_symbol = ?
      `;

  const [rows] = await pool.execute(sql, [userId, symbol]);
  if (rows.length === 0) return null;

  const { total_qty, sell_qty, total_cost } = rows[0];
  const remaining_qty = total_qty - sell_qty;

  if (remaining_qty <= 0) return null;

  // WACC is (Total Cost / Total Buy Quantity)
  // Note: This is simplified. True WACC might involve adjusting cost after partial sales.
  // But for alerts, "cost basis" is what matters.
  return total_cost / total_qty;
}

module.exports = {
  createPriceAlert,
  getUserPriceAlerts,
  updatePriceAlert,
  deletePriceAlert,
  getActivePriceAlerts,
  markAlertTriggered,
  updateAlertState,
  getUserHoldingWACC
};
