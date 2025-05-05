import type { OpenAPIV3 } from 'openapi-types';
import type { ApiReferenceConfigurationWithSources } from '@scalar/types/api-reference' with { "resolution-mode": "import" };
export declare const ScalarRender: (info: OpenAPIV3.InfoObject, version: string, config: Partial<ApiReferenceConfigurationWithSources>, cdn: string) => string;
