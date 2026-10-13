import { createContext } from 'react';
import type { SlideTemplate } from '../../shared/layout';

/** The operator's templates, so any slide preview can draw its layout. */
export const TemplatesContext = createContext<SlideTemplate[]>([]);
