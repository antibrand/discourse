import discourseComputed from "discourse-common/utils/decorators";
import EmberObject from "@ember/object";
import { ajax } from "discourse/lib/ajax";

/**
  A model representing a Topic's details that aren't always present, such as a list of participants.
  When showing topics in lists and such this information should not be required.
**/
import NotificationLevels from "discourse/lib/notification-levels";
import RestModel from "discourse/models/rest";

const TopicDetails = RestModel.extend({
  loaded: false,

  updateFromJson(details) {
    const topic = this.topic;

    if (details.allowed_users) {
      details.allowed_users = details.allowed_users.map(function(u) {
        return Discourse.User.create(u);
      });
    }

    if (details.participants) {
      details.participants = details.participants.map(function(p) {
        p.topic = topic;
        return EmberObject.create(p);
      });
    }

    this.setProperties(details);
    this.set("loaded", true);
  },

  @discourseComputed("notification_level", "notifications_reason_id")
  notificationReasonText(level, reason) {
    if (typeof level !== "number") {
      level = 1;
    }

    let localeString = `topic.notifications.reasons.${level}`;
    if (typeof reason === "number") {
      const tmp = localeString + "_" + reason;
      // some sane protection for missing translations of edge cases
      if (I18n.lookup(tmp, { locale: "en" })) {
        localeString = tmp;
      }
    }

    if (
      Discourse.User.currentProp("mailing_list_mode") &&
      level > NotificationLevels.MUTED
    ) {
      return I18n.t("topic.notifications.reasons.mailing_list_mode");
    } else {
      return I18n.t(localeString, {
        username: Discourse.User.currentProp("username_lower"),
        basePath: Discourse.BaseUri
      });
    }
  },

  updateNotifications(v) {
    this.set("notification_level", v);
    this.set("notifications_reason_id", null);
    return ajax("/t/" + this.get("topic.id") + "/notifications", {
      type: "POST",
      data: { notification_level: v }
    });
  },

  removeAllowedGroup(group) {
    const groups = this.allowed_groups;
    const name = group.name;

    return ajax("/t/" + this.get("topic.id") + "/remove-allowed-group", {
      type: "PUT",
      data: { name: name }
    }).then(() => {
      groups.removeObject(groups.findBy("name", name));
    });
  },

  removeAllowedUser(user) {
    const users = this.allowed_users;
    const username = user.get("username");

    return ajax("/t/" + this.get("topic.id") + "/remove-allowed-user", {
      type: "PUT",
      data: { username: username }
    }).then(() => {
      users.removeObject(users.findBy("username", username));
    });
  }
});

export default TopicDetails;
