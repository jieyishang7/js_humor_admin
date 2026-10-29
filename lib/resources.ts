/**
 * Declarative config for the generic admin pages (/r/[key]).
 * Each resource maps to one Supabase table. The server actions only ever
 * write the fields listed here, so the config doubles as a write whitelist.
 */

export type FieldType = "text" | "textarea" | "number" | "bool" | "select" | "email" | "domain";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** For "select": load options from another table. */
  options?: { table: string; value: string; label: string };
  /** Hide from create form (still editable if `editable`). */
  editable?: boolean;
  placeholder?: string;
};

export type Column = {
  name: string;
  label: string;
  kind?: "date" | "bool" | "mono" | "long" | "json" | "link-request";
};

export type Resource = {
  key: string;
  table: string;
  title: string;
  subtitle: string;
  group: string;
  select: string;
  orderBy: { column: string; ascending: boolean };
  idColumn?: string;
  ops: { create?: boolean; update?: boolean; delete?: boolean };
  fields: Field[];
  columns: Column[];
  /** Column bumped to now() on update, if the table has one. */
  touch?: string;
  /** "simple" = one-field add form + list (domains, whitelist). "cards" = term-style cards. */
  layout?: "table" | "simple" | "cards";
  searchColumns?: string[];
};

export const RESOURCES: Resource[] = [
  {
    key: "llm-providers",
    table: "llm_providers",
    title: "LLM Providers",
    subtitle: "All registered providers in the system.",
    group: "LLM",
    select: "id, created_datetime_utc, name, created_by_user_id, modified_by_user_id, modified_datetime_utc",
    orderBy: { column: "id", ascending: true },
    ops: { create: true, update: true, delete: true },
    touch: "modified_datetime_utc",
    fields: [{ name: "name", label: "Name", type: "text", required: true, placeholder: "Anthropic" }],
    columns: [
      { name: "id", label: "ID" },
      { name: "created_datetime_utc", label: "Created", kind: "date" },
      { name: "name", label: "Name" },
      { name: "created_by_user_id", label: "Created by user ID", kind: "mono" },
      { name: "modified_datetime_utc", label: "Modified", kind: "date" },
    ],
  },
  {
    key: "llm-models",
    table: "llm_models",
    title: "LLM Models",
    subtitle: "All registered models in the system.",
    group: "LLM",
    select:
      "id, created_datetime_utc, name, llm_provider_id, provider_model_id, is_temperature_supported, created_by_user_id, modified_datetime_utc",
    orderBy: { column: "id", ascending: true },
    ops: { create: true, update: true, delete: true },
    touch: "modified_datetime_utc",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, placeholder: "Gemini 3.8 Flash" },
      { name: "llm_provider_id", label: "Provider", type: "select", required: true, options: { table: "llm_providers", value: "id", label: "name" } },
      { name: "provider_model_id", label: "Provider model ID", type: "text", required: true, placeholder: "gemini-3.8-flash" },
      { name: "is_temperature_supported", label: "Temperature supported", type: "bool" },
    ],
    columns: [
      { name: "id", label: "ID" },
      { name: "created_datetime_utc", label: "Created", kind: "date" },
      { name: "name", label: "Name" },
      { name: "llm_provider_id", label: "LLM provider ID" },
      { name: "provider_model_id", label: "Provider model ID", kind: "mono" },
      { name: "is_temperature_supported", label: "Temperature supported", kind: "bool" },
      { name: "modified_datetime_utc", label: "Modified", kind: "date" },
    ],
  },
  {
    key: "prompt-chain-steps",
    table: "prompt_chain_steps",
    title: "Prompt Chain Steps",
    subtitle: "Every step of every prompt chain, in order.",
    group: "Prompt Pipeline",
    select: "id, prompt_chain_id, step_order, llm_model_id, step_type, input_type, output_type, temperature, system_prompt, user_prompt",
    orderBy: { column: "prompt_chain_id", ascending: true },
    ops: {},
    fields: [],
    columns: [
      { name: "id", label: "ID" },
      { name: "prompt_chain_id", label: "Chain" },
      { name: "step_order", label: "Order" },
      { name: "llm_model_id", label: "Model ID" },
      { name: "step_type", label: "Step type" },
      { name: "input_type", label: "Input" },
      { name: "output_type", label: "Output" },
      { name: "temperature", label: "Temp" },
      { name: "system_prompt", label: "System prompt", kind: "long" },
      { name: "user_prompt", label: "User prompt", kind: "long" },
    ],
  },
  {
    key: "prompt-chain-runs",
    table: "llm_prompt_chains",
    title: "LLM Prompt Chains",
    subtitle: "Every time a prompt chain ran for a generation request.",
    group: "LLM",
    select: "id, created_datetime_utc, prompt_chain_id, spot_request_id, profile_id",
    orderBy: { column: "created_datetime_utc", ascending: false },
    ops: {},
    fields: [],
    columns: [
      { name: "id", label: "Prompt chain ID" },
      { name: "created_datetime_utc", label: "Created", kind: "date" },
      { name: "prompt_chain_id", label: "Chain (flavor) ID" },
      { name: "spot_request_id", label: "Generation request", kind: "link-request" },
      { name: "profile_id", label: "Profile", kind: "mono" },
    ],
  },
  {
    key: "llm-responses",
    table: "llm_responses",
    title: "LLM Responses",
    subtitle: "Review model responses and processing details.",
    group: "LLM",
    select:
      "id, created_datetime_utc, llm_model_id, provider_model_id, spot_request_id, profile_id, prompt_chain_id, processing_time_seconds, succeeded, response",
    orderBy: { column: "created_datetime_utc", ascending: false },
    ops: {},
    fields: [],
    searchColumns: ["response", "provider_model_id"],
    columns: [
      { name: "id", label: "ID", kind: "mono" },
      { name: "created_datetime_utc", label: "Created", kind: "date" },
      { name: "provider_model_id", label: "Model", kind: "mono" },
      { name: "spot_request_id", label: "Request", kind: "link-request" },
      { name: "prompt_chain_id", label: "Chain ID" },
      { name: "processing_time_seconds", label: "Seconds" },
      { name: "succeeded", label: "OK", kind: "bool" },
      { name: "response", label: "Response", kind: "json" },
    ],
  },
  {
    key: "terms",
    table: "terms",
    title: "Terms",
    subtitle: "NYC words the AI should understand. Higher priority terms are sent to the model first.",
    group: "Terms",
    select: "id, term, term_type, definition, example, priority, created_datetime_utc, modified_datetime_utc",
    orderBy: { column: "priority", ascending: false },
    ops: { create: true, update: true, delete: true },
    touch: "modified_datetime_utc",
    layout: "cards",
    searchColumns: ["term", "definition"],
    fields: [
      { name: "term", label: "Term", type: "text", required: true, placeholder: "bodega" },
      { name: "term_type", label: "Type", type: "text", required: true, placeholder: "Noun" },
      { name: "priority", label: "Priority", type: "number", placeholder: "60" },
      { name: "definition", label: "Definition", type: "textarea", required: true },
      { name: "example", label: "Example", type: "textarea" },
    ],
    columns: [],
  },
  {
    key: "generation-examples",
    table: "generation_examples",
    title: "AI Generation Examples",
    subtitle: "Few-shot examples included in the prompt to show the AI what a great pick looks like.",
    group: "AI Media",
    select: "id, mood, example_output, explanation, priority, created_datetime_utc, modified_datetime_utc",
    orderBy: { column: "priority", ascending: false },
    ops: { create: true, update: true, delete: true },
    touch: "modified_datetime_utc",
    fields: [
      { name: "mood", label: "Mood (input)", type: "text", required: true, placeholder: "cheap first date" },
      { name: "example_output", label: "Example output (JSON)", type: "textarea", required: true },
      { name: "explanation", label: "Why it's a good example", type: "textarea" },
      { name: "priority", label: "Priority", type: "number" },
    ],
    columns: [
      { name: "id", label: "ID" },
      { name: "mood", label: "Mood" },
      { name: "example_output", label: "Example output", kind: "json" },
      { name: "explanation", label: "Explanation", kind: "long" },
      { name: "priority", label: "Priority" },
      { name: "modified_datetime_utc", label: "Modified", kind: "date" },
    ],
  },
  {
    key: "domains",
    table: "allowed_signup_domains",
    title: "Domains",
    subtitle: "Only users with emails from these domains (or whitelisted addresses) can sign in to Spot Finder.",
    group: "Whitelist",
    select: "id, apex_domain, created_datetime_utc",
    orderBy: { column: "apex_domain", ascending: true },
    ops: { create: true, update: true, delete: true },
    layout: "simple",
    fields: [{ name: "apex_domain", label: "Domain", type: "domain", required: true, placeholder: "e.g. example.com" }],
    columns: [],
  },
  {
    key: "emails",
    table: "whitelist_email_addresses",
    title: "E-Mail Addresses",
    subtitle: "These addresses can sign in even if their domain isn't on the list.",
    group: "Whitelist",
    select: "id, email_address, created_datetime_utc",
    orderBy: { column: "email_address", ascending: true },
    ops: { create: true, update: true, delete: true },
    layout: "simple",
    fields: [{ name: "email_address", label: "E-mail", type: "email", required: true, placeholder: "e.g. friend@gmail.com" }],
    columns: [],
  },
];

export function getResource(key: string) {
  return RESOURCES.find((r) => r.key === key);
}
