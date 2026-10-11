import "node:module";
import { dirname, isAbsolute, normalize, resolve } from "node:path";
const resolveCacheDependency = ({ dependency, configPath, root })=>{
    if (isAbsolute(dependency)) return normalize(dependency);
    if (configPath) return normalize(resolve(dirname(configPath), dependency));
    return root ? normalize(resolve(root, dependency)) : dependency;
};
const resolveBuildCache = ({ buildCache, configPath, root })=>{
    if (void 0 === buildCache) return;
    if (false === buildCache) return false;
    if (true === buildCache) return configPath ? {
        buildDependencies: [
            normalize(configPath)
        ]
    } : true;
    const buildDependencies = buildCache.buildDependencies?.map((dependency)=>resolveCacheDependency({
            dependency,
            configPath,
            root
        }));
    const nextBuildDependencies = configPath ? Array.from(new Set([
        ...buildDependencies || [],
        normalize(configPath)
    ])) : buildDependencies;
    return {
        cacheDirectory: buildCache.cacheDirectory,
        cacheDigest: buildCache.cacheDigest,
        buildDependencies: nextBuildDependencies
    };
};
const isNodeTarget = (target)=>{
    const targets = Array.isArray(target) ? target.filter(Boolean) : 'string' == typeof target ? [
        target
    ] : [];
    return targets.some((t)=>'async-node' === t || t.startsWith('node'));
};
const resolveTestEnvironmentFromTarget = (target)=>isNodeTarget(target) ? 'node' : 'happy-dom';
export { isNodeTarget, resolveBuildCache, resolveCacheDependency, resolveTestEnvironmentFromTarget };
