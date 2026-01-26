export function mockServer() {
  let queue = [] as Response[];
  let requests = [] as Request[];
  const server = Bun.serve({
    port: 0,
    fetch(req: Request): Response {
      requests.push(req);
      console.log("Queue size", queue.length);
      const output = queue.shift();
      console.log("Mock server received request:", req.url, output?.status);
      return output || new Response(null, { status: 404 });
    },
  });

  return {
    server,
    requests,
    enqueue: (item: Response) => {
      console.log("Enqueuing response with status:", item.status);
      queue.push(item);
    },
    reset: () => {
      queue = [];
      requests = [];
    },
  };
}
