export const includesByPatterns = (value, patterns = []) => {
  if (!value || !patterns?.length) {
    return false;
  }

  for (let i = 0; i < patterns.length; i += 1) {
    if (value.indexOf(patterns[i]) > -1) {
      return true;
    }
  }

  return false;
};

