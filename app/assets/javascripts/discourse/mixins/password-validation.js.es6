import { isEmpty } from "@ember/utils";
import InputValidation from "discourse/models/input-validation";
import { default as discourseComputed } from "discourse-common/utils/decorators";
import Mixin from "@ember/object/mixin";

export default Mixin.create({
  rejectedPasswords: null,

  init() {
    this._super(...arguments);
    this.set("rejectedPasswords", []);
    this.set("rejectedPasswordsMessages", new Map());
  },

  @discourseComputed("passwordMinLength")
  passwordInstructions() {
    return I18n.t("user.password.instructions", {
      count: this.passwordMinLength
    });
  },

  @discourseComputed("isDeveloper", "admin")
  passwordMinLength(isDeveloper, admin) {
    return isDeveloper || admin
      ? this.siteSettings.min_admin_password_length
      : this.siteSettings.min_password_length;
  },

  @discourseComputed(
    "accountPassword",
    "passwordRequired",
    "rejectedPasswords.[]",
    "accountUsername",
    "accountEmail",
    "passwordMinLength"
  )
  passwordValidation(
    password,
    passwordRequired,
    rejectedPasswords,
    accountUsername,
    accountEmail,
    passwordMinLength
  ) {
    if (!passwordRequired) {
      return InputValidation.create({ ok: true });
    }

    if (rejectedPasswords.includes(password)) {
      return InputValidation.create({
        failed: true,
        reason:
          this.rejectedPasswordsMessages.get(password) ||
          I18n.t("user.password.common")
      });
    }

    // If blank, fail without a reason
    if (isEmpty(password)) {
      return InputValidation.create({ failed: true });
    }

    // If too short
    if (password.length < passwordMinLength) {
      return InputValidation.create({
        failed: true,
        reason: I18n.t("user.password.too_short")
      });
    }

    if (!isEmpty(accountUsername) && password === accountUsername) {
      return InputValidation.create({
        failed: true,
        reason: I18n.t("user.password.same_as_username")
      });
    }

    if (!isEmpty(accountEmail) && password === accountEmail) {
      return InputValidation.create({
        failed: true,
        reason: I18n.t("user.password.same_as_email")
      });
    }

    // Looks good!
    return InputValidation.create({
      ok: true,
      reason: I18n.t("user.password.ok")
    });
  }
});
