import { isEmpty } from "@ember/utils";
import EmberObject from "@ember/object";
import InputValidation from "discourse/models/input-validation";
import {
  on,
  default as discourseComputed
} from "discourse-common/utils/decorators";
import Mixin from "@ember/object/mixin";

export default Mixin.create({
  @on("init")
  _createUserFields() {
    if (!this.site) {
      return;
    }

    let userFields = this.site.get("user_fields");
    if (userFields) {
      userFields = _.sortBy(userFields, "position").map(function(f) {
        return EmberObject.create({ value: null, field: f });
      });
    }
    this.set("userFields", userFields);
  },

  // Validate required fields
  @discourseComputed("userFields.@each.value")
  userFieldsValidation() {
    let userFields = this.userFields;
    if (userFields) {
      userFields = userFields.filterBy("field.required");
    }
    if (!isEmpty(userFields)) {
      const anyEmpty = userFields.any(uf => {
        const val = uf.get("value");
        return !val || isEmpty(val);
      });
      if (anyEmpty) {
        return InputValidation.create({ failed: true });
      }
    }
    return InputValidation.create({ ok: true });
  }
});
