node : node:internal/modules/package_json_reader:255
所在位置 行:1 字符: 1
+ node scripts/list-all-cards.mjs > all-cards-list.md 2>&1; Get-Content ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (node:internal/m...json_reader:255:String) [] 
   , RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'glob' imported from D:\gongzuo\web\Bord
Game\scripts\list-all-cards.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:255:9)
    at packageResolve (node:internal/modules/esm/resolve:767:81)
    at moduleResolve (node:internal/modules/esm/resolve:853:18)
    at defaultResolve (node:internal/modules/esm/resolve:983:11)
    at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:799:12)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:723:25)
    at ModuleLoader.resolve (node:internal/modules/esm/loader:706:38)
    at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:307:38)
    at #link (node:internal/modules/esm/module_job:170:49) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v24.1.0
