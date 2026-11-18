<script setup>
/*
 * ProductPicker — a searchable dropdown used instead of a native <select>.
 *
 * Why: the browser draws a <select>'s list itself, so it ignores our styles,
 * can't be searched, and long option text gets cut off at the screen edge.
 *
 * How it works:
 *  - The input box doubles as the search field. Closed, it shows the chosen
 *    product's name. Focused, it clears so you can type to filter.
 *  - Arrow keys move the highlight, Enter picks, Escape closes.
 *  - It talks to the parent through v-model (the product id).
 */
import { computed, nextTick, ref, watch } from "vue";
import { ChevronDown, Package, Search } from "@lucide/vue";

const props = defineProps({
  modelValue: { type: [Number, String], default: "" },
  products: { type: Array, default: () => [] },
  placeholder: { type: String, default: "Search product or SKU…" },
});
const emit = defineEmits(["update:modelValue"]);

const open = ref(false);
const query = ref("");
const active = ref(0); // index of the highlighted row
const listEl = ref(null);

const selected = computed(() => props.products.find((p) => p.id === Number(props.modelValue)));

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.products;
  return props.products.filter((p) => `${p.name} ${p.sku || ""} ${p.brand || ""}`.toLowerCase().includes(q));
});

// What the input shows: your typing while open, the chosen name while closed.
const inputText = computed(() => (open.value ? query.value : selected.value?.name || ""));

function stockClass(p) {
  if (!p.quantity) return "out";
  return p.quantity <= Number(p.reorder_level || 0) ? "low" : "";
}

function openList() {
  if (open.value) return;
  open.value = true;
  query.value = "";
  const index = filtered.value.findIndex((p) => p.id === selected.value?.id);
  active.value = Math.max(index, 0);
  scrollActiveIntoView();
}
function close() {
  open.value = false;
  query.value = "";
}
function choose(p) {
  emit("update:modelValue", p.id);
  close();
}
function onInput(event) {
  query.value = event.target.value;
  open.value = true;
  active.value = 0;
}
function onKeydown(event) {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    if (!open.value) return openList();
    const step = event.key === "ArrowDown" ? 1 : -1;
    active.value = (active.value + step + filtered.value.length) % Math.max(filtered.value.length, 1);
    scrollActiveIntoView();
  } else if (event.key === "Enter") {
    if (!open.value) return;
    event.preventDefault(); // don't submit the form
    const p = filtered.value[active.value];
    if (p) choose(p);
  } else if (event.key === "Escape" && open.value) {
    event.stopPropagation();
    close();
  }
}
function scrollActiveIntoView() {
  nextTick(() => listEl.value?.querySelector(".is-active")?.scrollIntoView({ block: "nearest" }));
}

// Reset the highlight if the list shrinks under it.
watch(filtered, (list) => {
  if (active.value >= list.length) active.value = 0;
});
</script>

<template>
  <div class="picker" :class="{ open }" @focusout="(e) => !e.currentTarget.contains(e.relatedTarget) && close()">
    <div class="picker-field">
      <Search v-if="open" :size="16" class="picker-lead" />
      <span v-else class="picker-lead picker-thumb">
        <img v-if="selected?.image_data" :src="selected.image_data" alt="" />
        <Package v-else :size="16" />
      </span>
      <input
        :value="inputText"
        :placeholder="open && selected ? selected.name : placeholder"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="open"
        autocomplete="off"
        @focus="openList"
        @click="openList"
        @input="onInput"
        @keydown="onKeydown"
      />
      <span v-if="selected && !open" class="picker-stock" :class="stockClass(selected)">{{ selected.quantity }} in stock</span>
      <ChevronDown :size="16" class="picker-chevron" />
    </div>

    <Transition name="picker-pop">
      <ul v-if="open" ref="listEl" class="picker-list" role="listbox">
        <li
          v-for="(p, i) in filtered"
          :key="p.id"
          role="option"
          :aria-selected="p.id === selected?.id"
          :class="{ 'is-active': i === active, 'is-selected': p.id === selected?.id }"
          tabindex="-1"
          @mousedown.prevent="choose(p)"
          @click.prevent
          @mousemove="active = i"
        >
          <div class="picker-name">
            <b>{{ p.name }}</b>
            <small>{{ p.sku }}</small>
          </div>
          <span class="picker-stock" :class="stockClass(p)">{{ p.quantity ? `${p.quantity} in stock` : "Out of stock" }}</span>
        </li>
        <li v-if="!filtered.length" class="picker-empty">No products match “{{ query }}”.</li>
      </ul>
    </Transition>
  </div>
</template>

<style>
/* Not scoped: OptionPicker.vue reuses these .picker-* classes. */
.picker {
  position: relative;
  color: var(--ink);
  font-size: 13px;
}
.picker-field {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 43px;
  padding: 0 12px 0 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  transition: box-shadow 0.15s, border-color 0.15s;
}
.picker.open .picker-field,
.picker-field:focus-within {
  border-color: var(--blue);
  box-shadow: 0 0 0 3px rgba(23, 105, 210, 0.1);
}
/* The input sits inside our styled box, so strip its own border. */
.picker .picker-field input,
.picker .picker-field input:focus {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  font-weight: 600;
  text-overflow: ellipsis;
}
.picker-lead {
  flex: none;
  color: var(--muted);
}
.picker-thumb {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  overflow: hidden;
  border-radius: 6px;
  background: var(--surface-3);
}
.picker-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.picker-chevron {
  flex: none;
  color: var(--muted);
  transition: transform 0.2s var(--ease-out);
}
.picker.open .picker-chevron {
  transform: rotate(180deg);
}

.picker-list {
  position: absolute;
  z-index: 30;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  max-height: 264px;
  margin: 0;
  padding: 6px;
  overflow-y: auto;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: var(--shadow-md);
}
.picker-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 7px;
  cursor: pointer;
}
.picker-list li.is-active {
  background: var(--surface-3);
}
.picker-list li.is-selected b {
  color: var(--blue);
}
.picker-name {
  display: grid;
  flex: 1;
  min-width: 0;
}
/* One line each — long names get "…" instead of wrapping. */
.picker-name b,
.picker-name small {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.picker-name b {
  font-size: 13px;
  font-weight: 700;
}
.picker-name small {
  color: var(--muted);
  font-size: 11px;
}
.picker-stock {
  flex: none;
  padding: 3px 8px;
  border-radius: 999px;
  color: var(--chart-good);
  background: color-mix(in srgb, var(--chart-good) 12%, transparent);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.picker-stock.low {
  color: #b7791f;
  background: color-mix(in srgb, var(--chart-warn) 18%, transparent);
}
.picker-stock.out {
  color: var(--chart-bad);
  background: color-mix(in srgb, var(--chart-bad) 12%, transparent);
}
/* OptionPicker's trigger is a <button>; make it look like the input box. */
.picker .picker-button {
  width: 100%;
  padding-left: 12px;
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.picker-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.picker-value.empty {
  color: var(--muted);
  font-weight: 500;
}
.picker-check {
  flex: none;
  color: var(--blue);
}
.picker-empty {
  justify-content: center;
  color: var(--muted);
  cursor: default !important;
}

/* Open: fade in while rising slightly, ease-out (no bounce). */
.picker-pop-enter-active {
  transition: opacity 0.18s var(--ease-out), transform 0.18s var(--ease-out);
}
.picker-pop-leave-active {
  transition: opacity 0.1s ease-in;
}
.picker-pop-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.picker-pop-leave-to {
  opacity: 0;
}
</style>
