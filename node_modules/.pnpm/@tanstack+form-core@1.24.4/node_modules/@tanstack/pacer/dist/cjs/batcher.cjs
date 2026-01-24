"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const store = require("@tanstack/store");
const utils = require("./utils.cjs");
const eventClient = require("./event-client.cjs");
function getDefaultBatcherState() {
  return {
    executionCount: 0,
    isEmpty: true,
    isPending: false,
    totalItemsProcessed: 0,
    items: [],
    size: 0,
    status: "idle"
  };
}
const defaultOptions = {
  getShouldExecute: () => false,
  maxSize: Infinity,
  started: true,
  wait: Infinity
};
class Batcher {
  constructor(fn, initialOptions) {
    this.fn = fn;
    this.store = new store.Store(
      getDefaultBatcherState()
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
        const { isPending, items } = combinedState;
        const size = items.length;
        const isEmpty = size === 0;
        return {
          ...combinedState,
          isEmpty,
          size,
          status: isPending ? "pending" : "idle"
        };
      });
      eventClient.emitChange("Batcher", this);
    };
    this.#getWait = () => {
      return utils.parseFunctionOrValue(this.options.wait, this);
    };
    this.addItem = (item) => {
      this.#setState({
        items: [...this.store.state.items, item],
        isPending: this.options.wait !== Infinity
      });
      this.options.onItemsChange?.(this);
      const shouldProcess = this.store.state.items.length >= this.options.maxSize || this.options.getShouldExecute(this.store.state.items, this);
      if (shouldProcess) {
        this.#execute();
      } else if (this.options.wait !== Infinity) {
        this.#clearTimeout();
        this.#timeoutId = setTimeout(() => this.#execute(), this.#getWait());
      }
    };
    this.#execute = () => {
      if (this.store.state.items.length === 0) {
        return;
      }
      const batch2 = this.peekAllItems();
      this.clear();
      this.options.onItemsChange?.(this);
      this.fn(batch2);
      this.#setState({
        executionCount: this.store.state.executionCount + 1,
        totalItemsProcessed: this.store.state.totalItemsProcessed + batch2.length
      });
      this.options.onExecute?.(batch2, this);
    };
    this.flush = () => {
      this.#clearTimeout();
      this.#execute();
    };
    this.peekAllItems = () => {
      return [...this.store.state.items];
    };
    this.#clearTimeout = () => {
      if (this.#timeoutId) {
        clearTimeout(this.#timeoutId);
        this.#timeoutId = null;
      }
    };
    this.clear = () => {
      this.#setState({ items: [], isPending: false });
    };
    this.reset = () => {
      this.#setState(getDefaultBatcherState());
      this.options.onItemsChange?.(this);
    };
    this.key = utils.createKey(initialOptions.key);
    this.options = {
      ...defaultOptions,
      ...initialOptions
    };
    this.#setState(this.options.initialState ?? {});
    eventClient.pacerEventClient.on("d-Batcher", (event) => {
      if (event.payload.key !== this.key) return;
      this.#setState(event.payload.store.state);
      this.setOptions(event.payload.options);
    });
  }
  #timeoutId;
  #setState;
  #getWait;
  #execute;
  #clearTimeout;
}
function batch(fn, options) {
  const batcher = new Batcher(fn, options);
  return batcher.addItem;
}
exports.Batcher = Batcher;
exports.batch = batch;
//# sourceMappingURL=batcher.cjs.map
