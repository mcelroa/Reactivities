import { createContext } from "react";
import CounterStore from "./counterStore";
import { UIStore } from "./uiStore";
import { ActivityStore } from "./activityStore";

interface Store {
   counterStore: CounterStore;
   uiStore: UIStore;
   activityStore: ActivityStore;
}

export const store: Store = {
   counterStore: new CounterStore(),
   uiStore: new UIStore(),
   activityStore: new ActivityStore(),
};

export const StoreContext = createContext(store);
