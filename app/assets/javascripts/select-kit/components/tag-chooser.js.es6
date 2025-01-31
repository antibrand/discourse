import { alias } from "@ember/object/computed";
import MultiSelectComponent from "select-kit/components/multi-select";
import TagsMixin from "select-kit/mixins/tags";
import renderTag from "discourse/lib/render-tag";
import discourseComputed from "discourse-common/utils/decorators";
import { makeArray } from "discourse-common/lib/helpers";
const { get, run } = Ember;

export default MultiSelectComponent.extend(TagsMixin, {
  pluginApiIdentifiers: ["tag-chooser"],
  classNames: "tag-chooser",
  isAsync: true,
  filterable: true,
  filterPlaceholder: "tagging.choose_for_topic",
  limit: null,
  blacklist: null,
  attributeBindings: ["categoryId"],
  allowCreate: null,
  allowAny: alias("allowCreate"),

  init() {
    this._super(...arguments);

    if (this.allowCreate !== false) {
      this.set("allowCreate", this.site.get("can_create_tag"));
    }

    if (!this.blacklist) {
      this.set("blacklist", []);
    }

    this.set("termMatchesForbidden", false);
    this.set("termMatchErrorMessage", null);

    this.set("templateForRow", rowComponent => {
      const tag = rowComponent.get("computedContent");
      return renderTag(get(tag, "value"), {
        count: get(tag, "originalContent.count"),
        noHref: true
      });
    });

    if (!this.unlimitedTagCount) {
      this.set(
        "maximum",
        parseInt(
          this.limit ||
            this.maximum ||
            this.get("siteSettings.max_tags_per_topic")
        )
      );
    }
  },

  mutateValues(values) {
    this.set("tags", values.filter(v => v));
  },

  @discourseComputed("tags")
  values(tags) {
    return makeArray(tags);
  },

  @discourseComputed("tags")
  content(tags) {
    return makeArray(tags);
  },

  actions: {
    onFilter(filter) {
      this.expand();
      this.set(
        "searchDebounce",
        run.debounce(this, this._prepareSearch, filter, 200)
      );
    },

    onExpand() {
      this.set(
        "searchDebounce",
        run.debounce(this, this._prepareSearch, this.filter, 200)
      );
    },

    onDeselect() {
      this.set(
        "searchDebounce",
        run.debounce(this, this._prepareSearch, this.filter, 200)
      );
    },

    onSelect() {
      this.set(
        "searchDebounce",
        run.debounce(this, this._prepareSearch, this.filter, 50)
      );
    }
  },

  _prepareSearch(query) {
    const selectedTags = makeArray(this.values).filter(t => t);

    const data = {
      q: query,
      limit: this.get("siteSettings.max_tag_search_results"),
      categoryId: this.categoryId
    };

    if (selectedTags.length || this.blacklist.length) {
      data.selected_tags = _.uniq(selectedTags.concat(this.blacklist)).slice(
        0,
        100
      );
    }

    if (!this.everyTag) data.filterForInput = true;

    this.searchTags("/tags/filter/search", data, this._transformJson);
  },

  _transformJson(context, json) {
    let results = json.results;

    context.set("termMatchesForbidden", json.forbidden ? true : false);
    context.set("termMatchErrorMessage", json.forbidden_message);

    if (context.get("blacklist")) {
      results = results.filter(result => {
        return !context.get("blacklist").includes(result.id);
      });
    }

    if (context.get("siteSettings.tags_sort_alphabetically")) {
      results = results.sort((a, b) => a.id > b.id);
    }

    results = results.map(result => {
      return { id: result.text, name: result.text, count: result.count };
    });

    return results;
  }
});
