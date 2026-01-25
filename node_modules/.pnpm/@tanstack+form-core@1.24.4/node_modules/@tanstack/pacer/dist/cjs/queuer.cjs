"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const store = require("@tanstack/store");
const utils = require("./utils.cjs");
const eventClient = require("./event-client.cjs");
function getDefaultQueuerState() {
  return {
    executionCount: 0,
    expirationCount: 0,
    isEmpty: true,
    isFull: false,
    isIdle: true,
    isRunning: true,
    itemTimestamps: [],
    items: [],
    pendingTick: false,
    rejectionCount: 0,
    size: 0,
    status: "idle",
    addItemCount: 0
  };
}
const defaultOptions = {
  addItemsTo: "back",
  getItemsFrom: "front",
  getPriority: (item) => item?.priority ?? 0,
  getIsExpired: () => false,
  expirationDuration: Infinity,
  initialItems: [],
  maxSize: Infinity,
  started: true,
  wait: 0
};
class Queuer {
  constructor(fn, initialOptions = {}) {
    this.fn = fn;
    this.store = new store.Store(
      getDefaultQueuerState()
    );
    this.#timeoutId = null;
    this.setOptions = (newOptions) => {
      this.options = { ...this.options, ...newOptions };
    };
    this.#setState = (newState) => {
      this.store.setState((state) => {
        const combinedState = {
          ...state,
          ...newState
        };
        const { items, isRunning } = combinedState;
        const size = items.length;
        const isFull = size >= (this.options.maxSize ?? Infinity);
        const isEmpty = size === 0;
        const isIdle = isRunning && isEmpty;
        const status = isIdle ? "idle" : isRunning ? "running" : "stopped";
        return {
          ...combinedState,
          isEmpty,
          isFull,
          isIdle,
          size,
          status
        };
      });
      eventClient.emitChange("Queuer", this);
    };
    this.#getWait = () => {
      return utils.parseFunctionOrValue(this.options.wait ?? 0, this);
    };
    this.#tick = () => {
      if (!this.store.state.isRunning) {
        this.#setState({ pendingTick: false });
        return;
      }
      this.#setState({ pendingTick: true });
      this.#checkExpiredItems();
      while (this.store.state.items.length > 0) {
        const nextItem = this.execute(this.options.getItemsFrom ?? "front");
        if (nextItem === void 0) {
          break;
        }
        const wait = this.#getWait();
        if (wait > 0) {
          this.#timeoutId = setTimeout(() => this.#tick(), wait);
          return;
        }
        this.#tick();
      }
      this.#setState({ pendingTick: false });
    };
    this.addItem = (item, position = this.options.addItemsTo ?? "back", runOnItemsChange = true) => {
      this.#setState({
        addItemCount: this.store.state.addItemCount + 1
      });
      if (this.store.state.items.length >= (this.options.maxSize ?? Infinity)) {
        this.#setState({
          rejectionCount: this.store.state.rejectionCount + 1
        });
        this.options.onReject?.(item, this);
        return false;
      }
      const priority = this.options.getPriority !== defaultOptions.getPriority ? this.options.getPriority(item) : item.priority;
      const items = this.store.state.items;
      const itemTimestamps = this.store.state.itemTimestamps;
      if (priority !== void 0) {
        const insertIndex = items.findIndex((existing) => {
          const existingPriority = this.options.getPriority !== defaultOptions.getPriority ? this.options.getPriority(existing) : existing.priority;
          return existingPriority < priority;
        });
        if (insertIndex === -1) {
          items.push(item);
          itemTimestamps.push(Date.now());
        } else {
          items.splice(insertIndex, 0, item);
          itemTimestamps.splice(insertIndex, 0, Date.now());
        }
      } else {
        if (position === "front") {
          items.unshift(item);
          itemTimestamps.unshift(Date.now());
        } else {
          items.push(item);
          itemTimestamps.push(Date.now());
        }
      }
      this.#setState({
        items,
        itemTimestamps
      });
      if (runOnItemsChange) {
        this.options.onItemsChange?.(this);
      }
      if (this.store.state.isRunning && !this.store.state.pendingTick) {
        this.#setState({ pendingTick: true });
        this.#tick();
      }
      return true;
    };
    this.getNextItem = (position = this.options.getItemsFrom ?? "front") => {
      const { items, itemTimestamps } = this.store.state;
      let item;
      if (this.options.getPriority !== defaultOptions.getPriority || position === "front") {
        item = items[0];
        if (item !== void 0) {
          this.#setState({
            items: items.slice(1),
            itemTimestamps: itemTimestamps.slice(1)
          });
        }
      } else {
        item = items[items.length - 1];
        if (item !== void 0) {
          this.#setState({
            items: items.slice(0, -1),
            itemTimestamps: itemTimestamps.slice(0, -1)
          });
        }
      }
      if (item !== void 0) {
        this.options.onItemsChange?.(this);
      }
      return item;
    };
    this.#getAllItems = () => {
      const items = this.peekAllItems();
      this.clear();
      return items;
    };
    this.execute = (position) => {
      const item = this.getNextItem(position);
      if (item !== void 0) {
        this.fn(item);
        this.#setState({
          executionCount: this.store.state.executionCount + 1
        });
        this.options.onExecute?.(item, this);
      }
      return item;
    };
    this.flush = (numberOfItems = this.store.state.items.length, position) => {
      this.#clearTimeout();
      for (let i = 0; i < numberOfItems; i++) {
        this.execute(position);
      }
      this.#tick();
    };
    this.flushAsBatch = (batchFunction) => {
      const items = this.#getAllItems();
      this.clear();
      batchFunction(items);
    };
    this.#checkExpiredItems = () => {
      if ((this.options.expirationDuration ?? Infinity) === Infinity && this.options.getIsExpired === defaultOptions.getIsExpired) {
        return;
      }
      const now = Date.now();
      const expiredIndices = [];
      for (let i = 0; i < this.store.state.items.length; i++) {
        const timestamp = this.store.state.itemTimestamps[i];
        if (timestamp === void 0) continue;
        const item = this.store.state.items[i];
        if (item === void 0) continue;
        const isExpired = this.options.getIsExpired !== defaultOptions.getIsExpired ? this.options.getIsExpired(item, timestamp) : now - timestamp > (this.options.expirationDuration ?? Infinity);
        if (isExpired) {
          expiredIndices.push(i);
        }
      }
      for (let i = expiredIndices.length - 1; i >= 0; i--) {
        const index = expiredIndices[i];
        if (index === void 0) continue;
        const expiredItem = this.store.state.items[index];
        if (expiredItem === void 0) continue;
        const newItems = [...this.store.state.items];
        const newTimestamps = [...this.store.state.itemTimestamps];
        newItems.splice(index, 1);
        newTimestamps.splice(index, 1);
        this.#setState({
          items: newItems,
          itemTimestamps: newTimestamps,
          expirationCount: this.store.state.expirationCount + 1
        });
        this.options.onExpire?.(expiredItem, this);
      }
      if (expiredIndices.length > 0) {
        this.options.onItemsChange?.(this);
      }
    };
    this.peekNextItem = (position = "front") => {
      if (position === "front") {
        return this.store.state.items[0];
      }
      return this.store.state.items[this.store.state.items.length - 1];
    };
    this.peekAllItems = () => {
      return [...this.store.state.items];
    };
    this.start = () => {
      this.#setState({ isRunning: true });
      if (!this.store.state.pendingTick && this.store.state.items.length > 0) {
        this.#tick();
      }
    };
    this.stop = () => {
      this.#clearTimeout();
      this.#setState({ isRunning: false, pendingTick: false });
    };
    this.#clearTimeout = () => {
      if (this.#timeoutId) {
        clearTimeout(this.#timeoutId);
        this.#timeoutId = null;
      }
    };
    this.clear = () => {
      this.#setState({ items: [], itemTimestamps: [] });
      this.options.onItemsChange?.(this);
    };
    this.reset = () => {
      this.#setState(getDefaultQueuerState());
      this.options.onItemsChange?.(this);
    };
    this.key = utils.createKey(initialOptions.key);
    this.options = {
      ...defaultOptions,
      ...initialOptions
    };
    const isInitiallyRunning = this.options.initialState?.isRunning ?? this.options.started ?? true;
    this.#setState({
      ...this.options.initialState,
      isRunning: isInitiallyRunning
    });
    if (this.options.initialState?.items) {
      if (this.store.state.isRunning) {
        this.#tick();
      }
    } else {
      for (let i = 0; i < (this.options.initialItems?.length ?? 0); i++) {
        const item = this.options.initialItems[i];
        const isLast = i === (this.options.initialItems?.length ?? 0) - 1;
        this.addItem(item, this.options.addItemsTo ?? "back", isLast);
      }
    }
    eventClient.pacerEventClient.on("d-Queuer", (event) => {
      if (event.payload.key !== this.key) return;
      this.#setState(event.payload.store.state);
      this.setOptions(event.payload.options);
    });
  }
  #timeoutId;
  #setState;
  #getWait;
  #tick;
  #getAllItems;
  #checkExpiredItems;
  #clearTimeout;
}
function queue(fn, initialOptions) {
  const queuer = new Queuer(fn, initialOptions);
  return queuer.addItem;
}
exports.Queuer = Queuer;
exports.queue = queue;
//# sourceMappingURL=queuer.cjs.map
