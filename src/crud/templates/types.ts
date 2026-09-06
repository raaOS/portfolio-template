/**
 * Per-Template CRUD Types
 * @module
 */

export interface TemplateCrudField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'array' | 'object' | 'boolean' | 'number' | 'image';
  required?: boolean;
  description?: string;
}

export interface TemplateCrudEntity {
  id: string;
  label: string;
  description: string;
  fields: TemplateCrudField[];
  apiPath: string;
  adminPath: string;
}

export interface TemplateCrudConfig {
  templateId: string;
  entities: TemplateCrudEntity[];
}
