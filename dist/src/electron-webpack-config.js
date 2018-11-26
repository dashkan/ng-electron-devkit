"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.electronConfig = {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWxlY3Ryb24td2VicGFjay1jb25maWcuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInNyYy9lbGVjdHJvbi13ZWJwYWNrLWNvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFhLFFBQUEsY0FBYyxHQUFHO0lBQzFCLE1BQU0sRUFBRSxtQkFBbUI7SUFDM0IsSUFBSSxFQUFFO1FBQ0YsU0FBUyxFQUFFLEtBQUs7S0FDbkI7SUFDRCxNQUFNLEVBQUU7UUFDSixLQUFLLEVBQUU7WUFDSDtnQkFDSSxJQUFJLEVBQUUsU0FBUztnQkFDZixHQUFHLEVBQUUsYUFBYTthQUNyQjtTQUNKO0tBQ0o7Q0FDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNvbnN0IGVsZWN0cm9uQ29uZmlnID0ge1xuICAgIHRhcmdldDogJ2VsZWN0cm9uLXJlbmRlcmVyJyxcbiAgICBub2RlOiB7XG4gICAgICAgIF9fZGlybmFtZTogZmFsc2UsXG4gICAgfSxcbiAgICBtb2R1bGU6IHtcbiAgICAgICAgcnVsZXM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0ZXN0OiAvXFwubm9kZSQvLFxuICAgICAgICAgICAgICAgIHVzZTogJ25vZGUtbG9hZGVyJ1xuICAgICAgICAgICAgfVxuICAgICAgICBdXG4gICAgfVxufTsiXX0=