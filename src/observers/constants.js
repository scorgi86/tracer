import { PubSub } from "./pub-sub.js";

export const originalFnSymbol = Symbol('originalFn');

export const emitterProp = Symbol('emitterProp');

export const emitter = new PubSub();

export const statePropSymbol = Symbol('traverse-state');

export const propertyMapSymbol = Symbol('property-map');

export const isProxySymbol = Symbol('proxy');