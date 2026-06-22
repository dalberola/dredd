// @ts-check
import which from 'which';

export default {
  /** @param {string} command */
  which(command) {
    try {
      which.sync(command);
      return true;
    } catch (e) {
      return false;
    }
  },
};
