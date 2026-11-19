function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
function assert(condition, code, message) {
  if (!condition) throw fail(code, message);
}
function schemaInputType(schema, name) {
  const entry = schema?.input?.required?.[name] ?? schema?.input?.optional?.[name];
  return Array.isArray(entry) ? entry[0] : undefined;
}
function hasSchemaInput(schema, name) {
  return Object.prototype.hasOwnProperty.call(schema?.input?.required ?? {}, name) ||
    Object.prototype.hasOwnProperty.call(schema?.input?.optional ?? {}, name);
}
function typesCompatible(input, output) {
  return !input || !output || input === output || input === "*" || output === "*" ||
    input === "ANY" || output === "ANY";
}

/**
 * Validates API-format ComfyUI prompt links.
 * When objectInfo is supplied from GET /object_info, validates declared inputs,
 * output slot bounds and connection types against the live runtime schema.
 */
export function validateComfyPromptGraph(prompt, objectInfo) {
  assert(prompt && typeof prompt === "object" && !Array.isArray(prompt),
    "INVALID_COMFY_PROMPT", "An API-format ComfyUI prompt object is required.");
  const nodes = Object.entries(prompt);
  assert(nodes.length > 0, "EMPTY_COMFY_PROMPT", "The ComfyUI prompt graph is empty.");

  const links = [];
  for (const [nodeId, node] of nodes) {
    assert(node && typeof node.class_type === "string" &&
      node.inputs && typeof node.inputs === "object" && !Array.isArray(node.inputs),
    "INVALID_COMFY_NODE", "Node " + nodeId + " is malformed.");
    for (const [inputName, value] of Object.entries(node.inputs)) {
      if (!Array.isArray(value)) continue;
      assert(value.length === 2 && typeof value[0] === "string" &&
        Number.isInteger(value[1]) && value[1] >= 0,
      "INVALID_COMFY_LINK", "Link at " + nodeId + "." + inputName + " must be [node_id, nonnegative_output_index].");
      assert(Object.prototype.hasOwnProperty.call(prompt, value[0]),
        "BROKEN_COMFY_LINK", "Node " + nodeId + "." + inputName + " references missing node " + value[0] + ".");
      links.push({ from: value[0], output: value[1], to: nodeId, input: inputName });
    }
  }

  const schemaWarnings = [];
  if (objectInfo && typeof objectInfo === "object") {
    for (const link of links) {
      const target = prompt[link.to];
      const source = prompt[link.from];
      const targetSchema = objectInfo[target.class_type];
      const sourceSchema = objectInfo[source.class_type];
      if (!targetSchema || !sourceSchema) {
        schemaWarnings.push({ code: "NODE_SCHEMA_UNAVAILABLE", node_id: !targetSchema ? link.to : link.from });
        continue;
      }
      assert(hasSchemaInput(targetSchema, link.input),
        "UNKNOWN_COMFY_INPUT", "Live schema does not declare " + target.class_type + "." + link.input + ".");
      if (!Array.isArray(sourceSchema.output)) {
        schemaWarnings.push({ code: "OUTPUT_SCHEMA_UNAVAILABLE", node_id: link.from });
        continue;
      }
      const outputTypes = sourceSchema.output;
      assert(link.output < outputTypes.length,
        "COMFY_OUTPUT_INDEX_OUT_OF_RANGE", "Node " + link.from + " has no output slot " + link.output + ".");
      const expected = schemaInputType(targetSchema, link.input);
      const actual = outputTypes[link.output];
      assert(typesCompatible(expected, actual),
        "COMFY_LINK_TYPE_MISMATCH", "Connection " + link.from + "[" + link.output + "] -> " +
          link.to + "." + link.input + " joins " + actual + " to " + expected + ".");
    }
  }

  return Object.freeze({
    valid: true,
    node_count: nodes.length,
    link_count: links.length,
    live_schema_checked: Boolean(objectInfo),
    schema_warnings: Object.freeze(schemaWarnings)
  });
}
