const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 设置控制台编码为UTF-8解决中文乱码问题
// 注释掉原来的实现以避免控制台窗口异常关闭
// if (process.platform === "win32") {
//   require('child_process').exec('chcp 65001');
// }

// 支持的图片格式
const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];

// MIME类型映射
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8'
};

// 读取目录中的图片文件（只获取当前目录的图片）
function getImageFiles(dir) {
  return new Promise((resolve, reject) => {
    // 处理中文路径编码问题
    const decodedDir = decodeURIComponent(dir);
    fs.readdir(decodedDir, (err, files) => {
      if (err) {
        reject(err);
        return;
      }
      
      // 过滤出图片文件
      const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return imageExtensions.includes(ext);
      });
      
      resolve(imageFiles);
    });
  });
}

// 读取目录中的文件夹（只获取直接子目录）
function getDirectories(dir) {
  return new Promise((resolve, reject) => {
    // 处理中文路径编码问题
    const decodedDir = decodeURIComponent(dir);
    fs.readdir(decodedDir, (err, files) => {
      if (err) {
        reject(err);
        return;
      }
      
      // 过滤出文件夹
      const directories = files.filter(file => {
        return fs.statSync(path.join(decodedDir, file)).isDirectory();
      });
      
      resolve(directories);
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url);
  let pathname = `.${parsedUrl.pathname}`;
  
  // 如果请求的是根路径，则返回index.html
  if (pathname === './') {
    pathname = './000.html';
  }
  
  // 如果请求的是文件夹列表API
  if (pathname === './api/directories') {
    try {
      const directories = await getDirectories('.');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(directories, null, 2));
      return;
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(`Error reading directory: ${err.message}`);
      return;
    }
  }
  
  // 如果请求的是特定文件夹下的子目录列表API
  if (pathname.startsWith('./api/subdirectories/')) {
    try {
      const folderName = decodeURIComponent(pathname.replace('./api/subdirectories/', ''));
      // 确保路径安全，防止目录遍历攻击
      const safePath = path.resolve(folderName);
      const rootPath = path.resolve('.');
      if (!safePath.startsWith(rootPath)) {
        throw new Error('非法路径访问');
      }
      const directories = await getDirectories(folderName);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(directories, null, 2));
      return;
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(`Error reading directory: ${err.message}`);
      return;
    }
  }
  
  // 如果请求的是特定文件夹下的图片列表API
  if (pathname.startsWith('./api/images/')) {
    try {
      const folderName = decodeURIComponent(pathname.replace('./api/images/', ''));
      // 确保路径安全，防止目录遍历攻击
      const safePath = path.resolve(folderName);
      const rootPath = path.resolve('.');
      if (!safePath.startsWith(rootPath)) {
        throw new Error('非法路径访问');
      }
      const imageFiles = await getImageFiles(folderName);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      // 正确处理文件路径，确保中文路径能被访问
      res.end(JSON.stringify(imageFiles.map(file => `${encodeURIComponent(folderName)}/${encodeURIComponent(file)}`), null, 2));
      return;
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(`Error reading directory: ${err.message}`);
      return;
    }
  }
  
  // 如果请求的是图片列表API（根目录）
  if (pathname === './api/images') {
    try {
      const imageFiles = await getImageFiles('.');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(imageFiles, null, 2));
      return;
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(`Error reading directory: ${err.message}`);
      return;
    }
  }
  
  const ext = path.parse(pathname).ext;
  
  // 检查是否为图片请求
  if (imageExtensions.includes(ext)) {
    // 处理中文路径编码问题
    const decodedPath = decodeURIComponent(pathname);
    fs.readFile(decodedPath, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(`File ${decodedPath} not found!`);
        return;
      }
      
      res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain; charset=utf-8');
      res.end(data);
    });
    return;
  }
  
  // 处理HTML和JS文件请求
  const decodedPath = decodeURIComponent(pathname);
  fs.readFile(decodedPath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(`File ${decodedPath} not found!`);
      return;
    }
    
    res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain; charset=utf-8');
    res.end(data);
  });
});

const port = 3000;
server.listen(port, () => {
  console.log(`服务器运行在：http://localhost:${port}/`);
});