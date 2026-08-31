const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

module.exports = (() => {
  const config = getSentryExpoConfig(__dirname);

  const { transformer, resolver } = config;

  config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve("react-native-svg-transformer"),
  };
  config.resolver = {
    ...resolver,
    blockList: [
      /.*test_.*/,
      /.*demo_transaction.*/,
      /.*tempCodeRunnerFile.*/,
    ],
    assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
    sourceExts: [...resolver.sourceExts, "svg"],
    resolverMainFields: ["react-native", "browser", "main"],
    extraNodeModules: {
      crypto: require.resolve("crypto-browserify"),
      stream: require.resolve("stream-browserify"),
      buffer: require.resolve("buffer"),
      url: require.resolve("url"),
      path: require.resolve("path-browserify"),
      http: require.resolve("stream-http"),
      https: require.resolve("https-browserify"),
      os: require.resolve("os-browserify/browser"),
      util: require.resolve("util"),
      zlib: require.resolve("browserify-zlib"),
      assert: require.resolve("assert"),
      events: require.resolve("events"),
      punycode: require.resolve("punycode"),
      querystring: require.resolve("querystring-es3"),
      string_decoder: require.resolve("string_decoder"),
      http2: require.resolve("./mocks/empty.js"),
      fs: require.resolve("./mocks/empty.js"),
      net: require.resolve("./mocks/empty.js"),
      tls: require.resolve("./mocks/empty.js"),
    },
  };

  return config;
})();