// 一些 Android WebView 缺少该标准接口，第三方依赖也会调用它。
if (typeof Object.hasOwn !== 'function') {
    Object.defineProperty(Object, 'hasOwn', {
        configurable: true,
        writable: true,
        value: (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key),
    });
}
