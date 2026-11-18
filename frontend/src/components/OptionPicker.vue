<script setup>
/*
 * OptionPicker — a styled replacement for a short native <select>
 * (Supplier, Adjustment type). No search box; just click and pick.
 * Looks the same as ProductPicker because it reuses its .picker-* styles.
 *
 * options: [{ value, label }]  — or plain strings, which act as both.
 */
import { computed, nextTick, ref } from "vue";
import { Check, ChevronDown } from "@lucide/vue";

const props = defineProps({
  modelValue: { type: [Number, String], default: "" },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: "Select…" },
});
const emit = defineEmits(["update:modelValue"]);

const open = ref(false);
const active = ref(0);
const listEl = ref(null);

const items = computed(() => props.options.map((o) => (typeof o === "object" ? o : { value: o, label: o })));
const selected = computed(() => items.value.find((o) => String(o.value) === String(props.modelValue)));

function toggle() {
  open.value = !open.value;
  if (open.value) {
    active.value = Math.max(items.value.indexOf(selected.value), 0);
    nextTick(() => listEl.value?.querySelector(".is-active")?.scrollIntoView({ block: "nearest" }));
  }
}
function choose(o) {
  emit("update:modelValue", o.value);
  open.value = false;
}
function onKeydown(event) {
  const n = items.value.length;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    if (!open.value) return toggle();
    active.value = (active.value + (event.key === "ArrowDown" ? 1 : -1) + n) % n;
  } else if ((event.key === "Enter" || event.key === " ") && open.value) {
    event.preventDefault(); // don't submit the form / re-toggle
    if (items.value[active.value]) choose(items.value[active.value]);
  } else if (event.key === "Escape" && open.value) {
    event.stopPropagation();
    open.value = false;
  }
}
</script>

<template>
  <div class="picker" :class="{ open }" @focusout="(e) => !e.currentTarget.contains(e.relatedTarget) && (open = false)">
    <button type="button" class="picker-field picker-button" aria-haspopup="listbox" :aria-expanded="open" @click.prevent="toggle" @keydown="onKeydown">
      <span class="picker-value" :class="{ empty: !selected }">{{ selected ? selected.label : placeholder }}</span>
      <ChevronDown :size="16" class="picker-chevron" />
    </button>

    <Transition name="picker-pop">
      <ul v-if="open" ref="listEl" class="picker-list" role="listbox">
        <li
          v-for="(o, i) in items"
          :key="o.value"
          role="option"
          :aria-selected="o === selected"
          :class="{ 'is-active': i === active, 'is-selected': o === selected }"
          @mousedown.prevent="choose(o)"
          @click.prevent
          @mousemove="active = i"
        >
          <div class="picker-name"><b>{{ o.label }}</b></div>
          <Check v-if="o === selected" :size="15" class="picker-check" />
        </li>
        <li v-if="!items.length" class="picker-empty">Nothing to choose yet.</li>
      </ul>
    </Transition>
  </div>
</template>
