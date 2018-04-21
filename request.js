const http = require('http');
const fs = require('fs');
function request (options, body, passthrough) {
  return new Promise((resolve, reject) => {
    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }
    let request = http.request(options, (response) => {
      let data = [ ];
      response.on('data', (chunk) => {
        data.push(chunk);
      }).on('end', () => {
        data = Buffer.concat(data);
        resolve({
          "data": data.toString('utf8'),
          "headers": response.headers
        });
      });
    }).on('error', (error) => {
      reject(error);
    });
    if (body) {
      request.write(body);
    }
    request.end();
  });
}
module.exports = request;
