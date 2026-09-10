import asyncio
import time
import httpx
import sys

async def run_load_test(target_url: str = "http://127.0.0.1:8000/api/health", total_requests: int = 200, concurrency: int = 20):
    print(f"Starting Load Test Simulation against {target_url}...")
    print(f"Total Requests: {total_requests} | Concurrency: {concurrency}")

    limits = httpx.Limits(max_keepalive_connections=concurrency, max_connections=concurrency * 2)
    async with httpx.AsyncClient(limits=limits, timeout=10.0) as client:
        semaphore = asyncio.Semaphore(concurrency)
        latencies = []
        status_codes = {}
        
        async def fetch():
            async with semaphore:
                start = time.time()
                try:
                    resp = await client.get(target_url)
                    dur = (time.time() - start) * 1000.0
                    latencies.append(dur)
                    code = resp.status_code
                    status_codes[code] = status_codes.get(code, 0) + 1
                except Exception as e:
                    latencies.append(10000.0)
                    status_codes["error"] = status_codes.get("error", 0) + 1

        overall_start = time.time()
        tasks = [asyncio.create_task(fetch()) for _ in range(total_requests)]
        await asyncio.gather(*tasks)
        total_time = time.time() - overall_start

    latencies.sort()
    rps = total_requests / total_time if total_time > 0 else 0
    median_lat = latencies[len(latencies) // 2] if latencies else 0
    p95_lat = latencies[int(len(latencies) * 0.95)] if latencies else 0
    p99_lat = latencies[int(len(latencies) * 0.99)] if latencies else 0

    print("\n=================== LOAD TEST RESULTS ===================")
    print(f"Total Time Elapsed  : {total_time:.3f} seconds")
    print(f"Requests Per Second : {rps:.2f} req/sec")
    print(f"Median Latency (p50): {median_lat:.2f} ms")
    print(f"P95 Latency         : {p95_lat:.2f} ms")
    print(f"P99 Latency         : {p99_lat:.2f} ms")
    print(f"Status Breakdown    : {status_codes}")
    print("=========================================================\n")

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000/api/health"
    asyncio.run(run_load_test(url))
