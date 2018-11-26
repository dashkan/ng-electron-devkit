export const electronConfig = {
    target: 'electron-renderer',
    node: {
        __dirname: false,
    },
    module: {
        rules: [
            {
                test: /\.node$/,
                use: 'node-loader'
            }
        ]
    }
};