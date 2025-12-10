const formatResponse = (data, message = 'Success') => {
  return {
    status: 'success',
    message: message,
    data: data
  };
};

const formatError = (message = 'Error', statusCode = 500) => {
  return {
    status: 'error',
    message: message,
    code: statusCode
  };
};

module.exports = { formatResponse, formatError };
