export function mockServer() {
  let queue = [] as Response[];
  let requests = [] as Request[];
  const server = Bun.serve({
    port: 0,
    fetch(req: Request): Response {
      requests.push(req);
      const output = queue.shift();
      return output || new Response(null, { status: 404 });
    },
  });

  return {
    server,
    requests,
    enqueue: (item: Response) => {
      queue.push(item);
    },
    reset: () => {
      queue = [];
      requests = [];
    },
  };
}
