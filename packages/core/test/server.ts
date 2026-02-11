export function mockServer() {
  const queue = [] as Response[];
  const requests = [] as Request[];
  const server = Bun.serve({
    port: 0,
    fetch(req: Request): Response {
      requests.push(req.clone() as Request);
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
  };
}
