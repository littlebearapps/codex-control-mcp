#!/usr/bin/env node

/**
 * Validate that all enhanced schemas are correctly structured
 */

const { CloudSubmitTool, CloudStatusTool, CloudResultsTool, CloudListTasksTool } = require('../dist/tools/cloud');

console.log('=== Schema Validation ===\n');

const schemas = [
  { name: 'CloudSubmitTool', schema: CloudSubmitTool.getSchema() },
  { name: 'CloudStatusTool', schema: CloudStatusTool.getSchema() },
  { name: 'CloudResultsTool', schema: CloudResultsTool.getSchema() },
  { name: 'CloudListTasksTool', schema: CloudListTasksTool.getSchema() },
];

let allValid = true;

schemas.forEach(({ name, schema }) => {
  console.log(`Validating ${name}...`);

  // Check required fields
  if (!schema.name) {
    console.log(`  ❌ Missing 'name' field`);
    allValid = false;
    return;
  }

  if (!schema.description) {
    console.log(`  ❌ Missing 'description' field`);
    allValid = false;
    return;
  }

  if (!schema.inputSchema) {
    console.log(`  ❌ Missing 'inputSchema' field`);
    allValid = false;
    return;
  }

  if (!schema.inputSchema.properties) {
    console.log(`  ❌ Missing 'inputSchema.properties' field`);
    allValid = false;
    return;
  }

  // Check description structure
  const desc = schema.description;
  const hasPrerequisites = desc.includes('PREREQUISITES') || desc.includes('USAGE');
  const hasWorkflow = desc.includes('WORKFLOW');

  console.log(`  ✅ name: ${schema.name}`);
  console.log(`  ✅ description: ${desc.substring(0, 60)}...`);
  console.log(`  ✅ inputSchema: ${Object.keys(schema.inputSchema.properties).length} properties`);
  console.log(`  ✅ structured sections: ${hasPrerequisites || hasWorkflow ? 'Yes' : 'No'}`);
  console.log('');
});

if (allValid) {
  console.log('✅ All schemas valid!\n');
  process.exit(0);
} else {
  console.log('❌ Some schemas invalid\n');
  process.exit(1);
}
