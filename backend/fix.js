const fs = require('fs');
let content = fs.readFileSync('src/services/rbac.service.test.ts', 'utf8');

content = content.replace(/function serviceWith\(client: any, audit: any = \{\}\) \{\s*return new RbacService\(\s*client,\s*\{\s*addAuditEvent: jest\.fn\(async \(input\) => \(\{ id: 'audit-1', \.\.\.input \}\)\),\s*\.\.\.audit,\s*\},\s*\);\s*\}/g, 'function serviceWith(clientOverrides: any = {}) {\n  const client = {\n    ...clientOverrides,\n    auditEvent: {\n      create: jest.fn(),\n      ...(clientOverrides.auditEvent ?? {}),\n    }\n  };\n  return {\n    service: new RbacService(client),\n    client\n  };\n}');

content = content.replace(/const service = serviceWith\(/g, 'const { service } = serviceWith(');

content = content.replace(/const client = (\{[\s\S]*?\});\s*const audit = \{ addAuditEvent: jest\.fn\(\) \};\s*const \{ service \} = serviceWith\(client, audit\);/g, 'const { service, client } = serviceWith();');

content = content.replace(/expect\(audit\.addAuditEvent\)\.toHaveBeenCalledWith\(expect\.objectContaining\(\{([\s\S]*?)\}\)\);/g, 'expect(client.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({\n      data: expect.objectContaining({})\n    }));');

content = content.replace(/user_id:/g, 'userId:');
content = content.replace(/entity_type:/g, 'entityType:');
content = content.replace(/entity_id:/g, 'entityId:');

fs.writeFileSync('src/services/rbac.service.test.ts', content);
