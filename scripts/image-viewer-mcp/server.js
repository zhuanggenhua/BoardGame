#!/usr/bin/env node
/**
 * 本地图片查看 MCP 服务器
 * 让 AI 能够读取项目中的图片文件
 */

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const fs = require("fs");
const path = require("path");

// 支持的图片格式
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif", ".bmp", ".ico"];

// MIME 类型映射
const MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};

// 获取工作目录（默认当前目录）
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();

class ImageViewerServer {
  constructor() {
    this.server = new Server(
      { name: "image-viewer", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );
    this.setupHandlers();
  }

  setupHandlers() {
    // 列出可用工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "view_image",
          description: "查看指定路径的图片文件，返回 base64 编码的图片数据",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "图片文件路径（相对于工作区根目录）",
              },
            },
            required: ["path"],
          },
        },
        {
          name: "list_images",
          description: "列出指定目录下的所有图片文件",
          inputSchema: {
            type: "object",
            properties: {
              directory: {
                type: "string",
                description: "目录路径（相对于工作区根目录），默认为根目录",
              },
              recursive: {
                type: "boolean",
                description: "是否递归搜索子目录，默认 false",
              },
              limit: {
                type: "number",
                description: "最大返回数量，默认 50",
              },
            },
          },
        },
        {
          name: "image_info",
          description: "获取图片文件的元信息（大小、格式等），不加载图片内容",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "图片文件路径（相对于工作区根目录）",
              },
            },
            required: ["path"],
          },
        },
      ],
    }));

    // 处理工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "view_image":
          return this.viewImage(args.path);
        case "list_images":
          return this.listImages(args.directory, args.recursive, args.limit);
        case "image_info":
          return this.imageInfo(args.path);
        default:
          throw new Error(`未知工具: ${name}`);
      }
    });
  }

  resolvePath(relativePath) {
    // 安全检查：防止路径遍历攻击
    const resolved = path.resolve(WORKSPACE_ROOT, relativePath || "");
    if (!resolved.startsWith(WORKSPACE_ROOT)) {
      throw new Error("路径不在工作区范围内");
    }
    return resolved;
  }

  async viewImage(imagePath) {
    try {
      const fullPath = this.resolvePath(imagePath);
      const ext = path.extname(fullPath).toLowerCase();

      if (!IMAGE_EXTENSIONS.includes(ext)) {
        return {
          content: [{ type: "text", text: `不支持的图片格式: ${ext}` }],
          isError: true,
        };
      }

      if (!fs.existsSync(fullPath)) {
        return {
          content: [{ type: "text", text: `文件不存在: ${imagePath}` }],
          isError: true,
        };
      }

      const imageBuffer = fs.readFileSync(fullPath);
      const base64 = imageBuffer.toString("base64");
      const mimeType = MIME_TYPES[ext] || "application/octet-stream";

      return {
        content: [
          {
            type: "image",
            data: base64,
            mimeType: mimeType,
          },
          {
            type: "text",
            text: `图片: ${imagePath}\n大小: ${(imageBuffer.length / 1024).toFixed(2)} KB\n格式: ${mimeType}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `读取图片失败: ${error.message}` }],
        isError: true,
      };
    }
  }

  async listImages(directory = "", recursive = false, limit = 50) {
    try {
      const fullPath = this.resolvePath(directory);
      const images = [];

      const scanDir = (dir, depth = 0) => {
        if (images.length >= limit) return;
        if (!fs.existsSync(dir)) return;

        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (images.length >= limit) break;

          const entryPath = path.join(dir, entry.name);

          if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (IMAGE_EXTENSIONS.includes(ext)) {
              const relativePath = path.relative(WORKSPACE_ROOT, entryPath);
              const stats = fs.statSync(entryPath);
              images.push({
                path: relativePath.replace(/\\/g, "/"),
                size: stats.size,
                format: ext,
              });
            }
          } else if (entry.isDirectory() && recursive && !entry.name.startsWith(".") && entry.name !== "node_modules") {
            scanDir(entryPath, depth + 1);
          }
        }
      };

      scanDir(fullPath);

      return {
        content: [
          {
            type: "text",
            text: `找到 ${images.length} 个图片文件:\n\n${images
              .map((img) => `- ${img.path} (${(img.size / 1024).toFixed(1)} KB)`)
              .join("\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `列出图片失败: ${error.message}` }],
        isError: true,
      };
    }
  }

  async imageInfo(imagePath) {
    try {
      const fullPath = this.resolvePath(imagePath);

      if (!fs.existsSync(fullPath)) {
        return {
          content: [{ type: "text", text: `文件不存在: ${imagePath}` }],
          isError: true,
        };
      }

      const stats = fs.statSync(fullPath);
      const ext = path.extname(fullPath).toLowerCase();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                path: imagePath,
                format: ext,
                mimeType: MIME_TYPES[ext] || "unknown",
                size: stats.size,
                sizeKB: (stats.size / 1024).toFixed(2),
                modified: stats.mtime.toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `获取图片信息失败: ${error.message}` }],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Image Viewer MCP 服务器已启动");
  }
}

const server = new ImageViewerServer();
server.run().catch(console.error);
