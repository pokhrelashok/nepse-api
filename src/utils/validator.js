/**
 * Lightweight Validation Utility
 */

/**
 * Validates request data against a schema
 * @param {Object} data - The object to validate (usually req.body)
 * @param {Object} schema - The validation rules
 * @returns {Object} { isValid, error, errors, data }
 */
function validate(data, schema) {
  const errors = [];
  const validated = {};

  for (const [key, rules] of Object.entries(schema)) {
    let value = data[key];

    // 1. Required Check
    if (rules.required && (value === undefined || value === null || (typeof value === 'string' && value.trim().length === 0))) {
      errors.push(rules.message || `${key} is required`);
      continue;
    }

    // 2. Handle Optional/Defaults
    if (value === undefined || value === null) {
      if (rules.default !== undefined) {
        validated[key] = rules.default;
      }
      continue;
    }

    // 3. Type & Constraint Logic
    if (rules.type === 'string') {
      if (typeof value !== 'string') {
        errors.push(`${key} must be a string`);
      } else {
        value = value.trim();
        if (rules.max && value.length > rules.max) {
          errors.push(rules.message || `${key} too long (max ${rules.max} chars)`);
        }
        validated[key] = value;
      }
    }
    else if (rules.type === 'number') {
      const num = parseFloat(value);
      if (isNaN(num)) {
        errors.push(`${key} must be a number`);
      } else {
        if (rules.positive && num <= 0) {
          errors.push(rules.message || `${key} must be a positive number`);
        }
        if (rules.min !== undefined && num < rules.min) {
          errors.push(rules.message || `${key} must be at least ${rules.min}`);
        }
        validated[key] = num;
      }
    }
    else if (rules.type === 'enum') {
      if (!rules.values.includes(value)) {
        errors.push(rules.message || `${key} must be one of: ${rules.values.join(', ')}`);
      } else {
        validated[key] = value;
      }
    }
    else {
      validated[key] = value;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    error: errors.length > 0 ? errors[0] : null,
    data: validated
  };
}

module.exports = { validate };
