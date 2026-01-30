/**
 * Minimal OpenAPI 3.1 type definitions for the spec.
 * We define just enough to type-check our spec object without pulling in openapi-types.
 */
export namespace OpenAPIV3_1 {
  export interface Document {
    openapi: string;
    info: InfoObject;
    servers?: ServerObject[];
    paths: PathsObject;
    components?: ComponentsObject;
    security?: SecurityRequirementObject[];
    tags?: TagObject[];
    externalDocs?: ExternalDocumentationObject;
  }

  export interface InfoObject {
    title: string;
    version: string;
    description?: string;
    termsOfService?: string;
    contact?: ContactObject;
    license?: LicenseObject;
  }

  export interface ContactObject {
    name?: string;
    url?: string;
    email?: string;
  }

  export interface LicenseObject {
    name: string;
    url?: string;
    identifier?: string;
  }

  export interface ServerObject {
    url: string;
    description?: string;
    variables?: Record<string, ServerVariableObject>;
  }

  export interface ServerVariableObject {
    enum?: string[];
    default: string;
    description?: string;
  }

  export interface PathsObject {
    [path: string]: PathItemObject;
  }

  export interface PathItemObject {
    summary?: string;
    description?: string;
    get?: OperationObject;
    put?: OperationObject;
    post?: OperationObject;
    delete?: OperationObject;
    options?: OperationObject;
    head?: OperationObject;
    patch?: OperationObject;
    trace?: OperationObject;
    parameters?: ParameterObject[];
  }

  export interface OperationObject {
    tags?: string[];
    summary?: string;
    description?: string;
    operationId?: string;
    parameters?: ParameterObject[];
    requestBody?: RequestBodyObject;
    responses: ResponsesObject;
    security?: SecurityRequirementObject[];
    deprecated?: boolean;
    externalDocs?: ExternalDocumentationObject;
  }

  export interface ParameterObject {
    name: string;
    in: "query" | "header" | "path" | "cookie";
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    schema?: SchemaObject | ReferenceObject;
  }

  export interface RequestBodyObject {
    description?: string;
    content: ContentObject;
    required?: boolean;
  }

  export type ContentObject = Record<string, MediaTypeObject>;

  export interface MediaTypeObject {
    schema?: SchemaObject | ReferenceObject;
    example?: unknown;
    examples?: Record<string, unknown>;
  }

  export type ResponsesObject = Record<string, ResponseObject>;

  export interface ResponseObject {
    description: string;
    headers?: Record<string, HeaderObject | ReferenceObject>;
    content?: ContentObject;
  }

  export interface HeaderObject {
    description?: string;
    required?: boolean;
    schema?: SchemaObject | ReferenceObject;
  }

  export interface ComponentsObject {
    schemas?: Record<string, SchemaObject | ReferenceObject>;
    responses?: Record<string, ResponseObject | ReferenceObject>;
    parameters?: Record<string, ParameterObject | ReferenceObject>;
    requestBodies?: Record<string, RequestBodyObject | ReferenceObject>;
    headers?: Record<string, HeaderObject | ReferenceObject>;
    securitySchemes?: Record<string, SecuritySchemeObject | ReferenceObject>;
  }

  export interface SchemaObject {
    type?: string;
    format?: string;
    items?: SchemaObject | ReferenceObject;
    properties?: Record<string, SchemaObject | ReferenceObject>;
    additionalProperties?: boolean | SchemaObject | ReferenceObject;
    required?: string[];
    enum?: unknown[];
    description?: string;
    nullable?: boolean;
    example?: unknown;
    default?: unknown;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    minItems?: number;
    $ref?: string;
    [key: string]: unknown;
  }

  export interface ReferenceObject {
    $ref: string;
    summary?: string;
    description?: string;
  }

  export interface SecuritySchemeObject {
    type: string;
    description?: string;
    name?: string;
    in?: string;
    scheme?: string;
    bearerFormat?: string;
    flows?: unknown;
    openIdConnectUrl?: string;
  }

  export interface SecurityRequirementObject {
    [name: string]: string[];
  }

  export interface TagObject {
    name: string;
    description?: string;
    externalDocs?: ExternalDocumentationObject;
  }

  export interface ExternalDocumentationObject {
    description?: string;
    url: string;
  }
}
