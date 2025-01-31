import { isEmpty } from "@ember/utils";
import { notEmpty, equal } from "@ember/object/computed";
import { ajax } from "discourse/lib/ajax";
import {
  default as discourseComputed,
  observes
} from "discourse-common/utils/decorators";
import GroupHistory from "discourse/models/group-history";
import RestModel from "discourse/models/rest";
import Category from "discourse/models/category";
import User from "discourse/models/user";
import Topic from "discourse/models/topic";
import { popupAjaxError } from "discourse/lib/ajax-error";
import EmberObject from "@ember/object";

const Group = RestModel.extend({
  limit: 50,
  offset: 0,
  user_count: 0,

  init() {
    this._super(...arguments);

    this.set("owners", []);
  },

  hasOwners: notEmpty("owners"),

  @discourseComputed("automatic_membership_email_domains")
  emailDomains(value) {
    return isEmpty(value) ? "" : value;
  },

  @discourseComputed("automatic")
  type(automatic) {
    return automatic ? "automatic" : "custom";
  },

  @discourseComputed("user_count")
  userCountDisplay(userCount) {
    // don't display zero its ugly
    if (userCount > 0) {
      return userCount;
    }
  },

  findMembers(params) {
    if (isEmpty(this.name) || !this.can_see_members) {
      return;
    }

    const offset = Math.min(this.user_count, Math.max(this.offset, 0));

    return Group.loadMembers(this.name, offset, this.limit, params).then(
      result => {
        const ownerIds = {};
        result.owners.forEach(owner => (ownerIds[owner.id] = true));

        this.setProperties({
          user_count: result.meta.total,
          limit: result.meta.limit,
          offset: result.meta.offset,
          members: result.members.map(member => {
            if (ownerIds[member.id]) {
              member.owner = true;
            }
            return User.create(member);
          }),
          owners: result.owners.map(owner => User.create(owner))
        });
      }
    );
  },

  removeOwner(member) {
    return ajax(`/admin/groups/${this.id}/owners.json`, {
      type: "DELETE",
      data: { user_id: member.id }
    }).then(() => {
      // reload member list
      this.findMembers();
    });
  },

  removeMember(member, params) {
    return ajax(`/groups/${this.id}/members.json`, {
      type: "DELETE",
      data: { user_id: member.id }
    }).then(() => this.findMembers(params));
  },

  addMembers(usernames, filter) {
    return ajax(`/groups/${this.id}/members.json`, {
      type: "PUT",
      data: { usernames }
    }).then(response => {
      if (filter) {
        this._filterMembers(response);
      } else {
        this.findMembers();
      }
    });
  },

  addOwners(usernames, filter) {
    return ajax(`/admin/groups/${this.id}/owners.json`, {
      type: "PUT",
      data: { group: { usernames } }
    }).then(response => {
      if (filter) {
        this._filterMembers(response);
      } else {
        this.findMembers();
      }
    });
  },

  _filterMembers(response) {
    return this.findMembers({ filter: response.usernames.join(",") });
  },

  @discourseComputed("display_name", "name")
  displayName(groupDisplayName, name) {
    return groupDisplayName || name;
  },

  @discourseComputed("flair_bg_color")
  flairBackgroundHexColor(flairBgColor) {
    return flairBgColor
      ? flairBgColor.replace(new RegExp("[^0-9a-fA-F]", "g"), "")
      : null;
  },

  @discourseComputed("flair_color")
  flairHexColor(flairColor) {
    return flairColor
      ? flairColor.replace(new RegExp("[^0-9a-fA-F]", "g"), "")
      : null;
  },

  canEveryoneMention: equal("mentionable_level", 99),

  @discourseComputed("visibility_level")
  isPrivate(visibilityLevel) {
    return visibilityLevel > 1;
  },

  @observes("isPrivate", "canEveryoneMention")
  _updateAllowMembershipRequests() {
    if (this.isPrivate || !this.canEveryoneMention) {
      this.set("allow_membership_requests", false);
    }
  },

  asJSON() {
    const attrs = {
      name: this.name,
      mentionable_level: this.mentionable_level,
      messageable_level: this.messageable_level,
      visibility_level: this.visibility_level,
      members_visibility_level: this.members_visibility_level,
      automatic_membership_email_domains: this.emailDomains,
      automatic_membership_retroactive: !!this.automatic_membership_retroactive,
      title: this.title,
      primary_group: !!this.primary_group,
      grant_trust_level: this.grant_trust_level,
      incoming_email: this.incoming_email,
      flair_url: this.flair_url,
      flair_bg_color: this.flairBackgroundHexColor,
      flair_color: this.flairHexColor,
      bio_raw: this.bio_raw,
      public_admission: this.public_admission,
      public_exit: this.public_exit,
      allow_membership_requests: this.allow_membership_requests,
      full_name: this.full_name,
      default_notification_level: this.default_notification_level,
      membership_request_template: this.membership_request_template,
      publish_read_state: this.publish_read_state
    };

    if (!this.id) {
      attrs["usernames"] = this.usernames;
      attrs["owner_usernames"] = this.ownerUsernames;
    }

    return attrs;
  },

  create() {
    return ajax("/admin/groups", {
      type: "POST",
      data: { group: this.asJSON() }
    }).then(resp => {
      this.setProperties({
        id: resp.basic_group.id,
        usernames: null,
        ownerUsernames: null
      });

      this.findMembers();
    });
  },

  save() {
    return ajax(`/groups/${this.id}`, {
      type: "PUT",
      data: { group: this.asJSON() }
    });
  },

  destroy() {
    if (!this.id) {
      return;
    }
    return ajax(`/admin/groups/${this.id}`, { type: "DELETE" });
  },

  findLogs(offset, filters) {
    return ajax(`/groups/${this.name}/logs.json`, {
      data: { offset, filters }
    }).then(results => {
      return EmberObject.create({
        logs: results["logs"].map(log => GroupHistory.create(log)),
        all_loaded: results["all_loaded"]
      });
    });
  },

  findPosts(opts) {
    opts = opts || {};
    const type = opts.type || "posts";
    const data = {};

    if (opts.beforePostId) {
      data.before_post_id = opts.beforePostId;
    }

    if (opts.categoryId) {
      data.category_id = parseInt(opts.categoryId);
    }

    return ajax(`/groups/${this.name}/${type}.json`, { data }).then(posts => {
      return posts.map(p => {
        p.user = User.create(p.user);
        p.topic = Topic.create(p.topic);
        p.category = Category.findById(p.category_id);
        return EmberObject.create(p);
      });
    });
  },

  setNotification(notification_level, userId) {
    this.set("group_user.notification_level", notification_level);
    return ajax(`/groups/${this.name}/notifications`, {
      data: { notification_level, user_id: userId },
      type: "POST"
    });
  },

  requestMembership(reason) {
    return ajax(`/groups/${this.name}/request_membership`, {
      type: "POST",
      data: { reason }
    });
  }
});

Group.reopenClass({
  findAll(opts) {
    return ajax("/groups/search.json", { data: opts }).then(groups =>
      groups.map(g => Group.create(g))
    );
  },

  loadMembers(name, offset, limit, params) {
    return ajax(`/groups/${name}/members.json`, {
      data: Object.assign(
        {
          limit: limit || 50,
          offset: offset || 0
        },
        params || {}
      )
    });
  },

  mentionable(name) {
    return ajax(`/groups/${name}/mentionable`);
  },

  messageable(name) {
    return ajax(`/groups/${name}/messageable`);
  },

  checkName(name) {
    return ajax("/groups/check-name", {
      data: { group_name: name }
    }).catch(popupAjaxError);
  }
});

export default Group;
