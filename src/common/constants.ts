// Note to reader: The code here is a bit weird as an artifact of how Typescript works. I want
// to create an array that can be used at runtime (e.g. to populate a dropdown menu, or do
// server-side validation), but I also want to create a type containing that array's values
// (e.g. the SupportedLanguage type should be defined as 'C' | 'C++'). We can accomplish the
// latter goal by defining SUPPORTED_LANGUAGES as "['C', 'C++'] as const" (the "as const" is
// necessary so Typescript knows it can use the values in the array at compile time) and then
// defining a type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]. However, if we do
// this, the original SUPPORTED_LANGUAGES array becomes unusable at runtime for validation
// purposes; you can't do things like SUPPORTED_LANGUAGES.includes(<string>) because TS is like
// "well, that array is of type ('C' | 'C++')[], so there is a type mismatch looking for an
// arbitrary string in there." So, we do this ugly thing where we create a private const array
// containing the values we want, then cast it to ReadonlyArray<string> for runtime use in the rest
// of the codebase, and also create a type using that const arr for compilation type-checking
// purposes.
//
// Maybe in the future I will figure out some less ugly way of doing this...

const COMPILERS_ARR = ['gcc', 'g++'] as const;
export const COMPILERS = COMPILERS_ARR as ReadonlyArray<string>;
export type Compiler = typeof COMPILERS_ARR[number];

const SUPPORTED_VERSIONS_ARR = ['C99', 'C11', 'C++11', 'C++14', 'C++17'] as const;
export const SUPPORTED_VERSIONS = SUPPORTED_VERSIONS_ARR as ReadonlyArray<string>;
export type SupportedVersion = typeof SUPPORTED_VERSIONS_ARR[number];

export const DEFAULT_VERSION = 'C++17';

const OPTIMIZATION_LEVELS_ARR = ['-O0', '-O1', '-O2', '-O3'] as const;
export const OPTIMIZATION_LEVELS = OPTIMIZATION_LEVELS_ARR as ReadonlyArray<string>;
export type OptimizationLevel = typeof OPTIMIZATION_LEVELS_ARR[number];

export const COMPILER_FLAGS = [
    { flag: '-Wall', label: '-Wall (recommended warnings)' },
    { flag: '-no-pie', label: '-no-pie (disable relocations)' },
    { flag: '-fpie -Wl,-pie', label: '-fpie -Wl,-pie (ASLR)' },
    {
        flag: '-fstack-protector-strong',
        label: '-fstack-protector-strong (anti-stack smashing)',
    },
] as const;

export const LINKER_FLAGS = [
    { flag: '-lm', label: '-lm (math)' },
    { flag: '-pthread', label: '-pthread (threading)' },
    { flag: '-lcrypt', label: '-lcrypt (crypto)' },
    { flag: '-lreadline', label: '-lreadline' },
    { flag: '-ll', label: '-ll (flex)' },
    { flag: '-lrt', label: '-lrt' },
] as const;

const FLAG_WHITELIST_ARR = [
    ...OPTIMIZATION_LEVELS_ARR,
    ...COMPILER_FLAGS.map((obj) => obj.flag),
    ...LINKER_FLAGS.map((obj) => obj.flag),
] as const;
export const FLAG_WHITELIST = FLAG_WHITELIST_ARR as ReadonlyArray<string>;
export type CompilerFlag = typeof FLAG_WHITELIST_ARR[number];

const THEMES_ARR = ['monokai', 'zenburn'] as const;
export const THEMES = THEMES_ARR as ReadonlyArray<string>;
export type Theme = typeof THEMES_ARR[number];
