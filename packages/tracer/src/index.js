const { Tracer } = require('./tracer.js');
const Reports = require('./reports');

if (typeof window !== 'undefined') {
  window.Tracer = Tracer;
}

module.exports = {
    Tracer,
    Reports
}
