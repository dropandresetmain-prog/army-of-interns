/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assignments from "../assignments.js";
import type * as capabilities from "../capabilities.js";
import type * as companyProfiles from "../companyProfiles.js";
import type * as events from "../events.js";
import type * as http from "../http.js";
import type * as messaging from "../messaging.js";
import type * as messagingOutbound from "../messagingOutbound.js";
import type * as model_validators from "../model/validators.js";
import type * as seed from "../seed.js";
import type * as workItems from "../workItems.js";
import type * as workers from "../workers.js";
import type * as workforce from "../workforce.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assignments: typeof assignments;
  capabilities: typeof capabilities;
  companyProfiles: typeof companyProfiles;
  events: typeof events;
  http: typeof http;
  messaging: typeof messaging;
  messagingOutbound: typeof messagingOutbound;
  "model/validators": typeof model_validators;
  seed: typeof seed;
  workItems: typeof workItems;
  workers: typeof workers;
  workforce: typeof workforce;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
