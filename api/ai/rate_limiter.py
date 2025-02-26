from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
import asyncio
import logging


@dataclass
class RateLimitInfo:
    requests_remaining: int
    requests_reset: datetime
    tokens_remaining: int
    tokens_reset: datetime
    input_tokens_remaining: int
    input_tokens_reset: datetime
    output_tokens_remaining: int
    output_tokens_reset: datetime
    retry_after: int
    timestamp: datetime  # when this object was created

    @classmethod
    def from_headers(cls, headers: dict) -> "RateLimitInfo":
        """Create RateLimitInfo from API response headers"""
        now = datetime.now(timezone.utc)
        future = now + timedelta(seconds=60)  # Default to 60 seconds in the future

        def parse_date(date_str):
            if not date_str:
                return future
            try:
                return datetime.fromisoformat(date_str)
            except ValueError:
                return future

        return cls(
            requests_remaining=int(
                headers.get("anthropic-ratelimit-requests-remaining", 0)
            ),
            requests_reset=parse_date(
                headers.get("anthropic-ratelimit-requests-reset")
            ),
            tokens_remaining=int(
                headers.get("anthropic-ratelimit-tokens-remaining", 0)
            ),
            tokens_reset=parse_date(
                headers.get("anthropic-ratelimit-tokens-reset")
            ),
            input_tokens_remaining=int(
                headers.get("anthropic-ratelimit-input-tokens-remaining", 0)
            ),
            input_tokens_reset=parse_date(
                headers.get("anthropic-ratelimit-input-tokens-reset")
            ),
            output_tokens_remaining=int(
                headers.get("anthropic-ratelimit-output-tokens-remaining", 0)
            ),
            output_tokens_reset=parse_date(
                headers.get("anthropic-ratelimit-output-tokens-reset")
            ),
            retry_after=int(headers.get("retry-after", 0)),
            timestamp=now,
        )

    def should_wait(self, logger) -> tuple[bool, float]:
        """Determine if we need to wait and how long"""
        current_time = datetime.now(timezone.utc)

        # Check all limits and find the most restrictive one
        wait_times = []
        if self.requests_remaining <= 0:
            wait_times.append((self.requests_reset - current_time).total_seconds())
        if self.tokens_remaining <= 0:
            wait_times.append((self.tokens_reset - current_time).total_seconds())
        if self.input_tokens_remaining <= 0:
            wait_times.append((self.input_tokens_reset - current_time).total_seconds())
        if self.output_tokens_remaining <= 0:
            wait_times.append((self.output_tokens_reset - current_time).total_seconds())

        if wait_times:
            max_wait_time = max(0.0, max(wait_times))
            logger.warning(
                f"We are supposed to wait {max_wait_time}s due to anthropic rate limits..."
            )
            return True, max_wait_time
        return False, 0

    def __str__(self):
        return (
            f"RateLimitInfo(requests_remaining={self.requests_remaining},\n"
            f" requests_reset={self.requests_reset},\n"
            f" tokens_remaining={self.tokens_remaining},\n"
            f" tokens_reset={self.tokens_reset},\n"
            f" input_tokens_remaining={self.input_tokens_remaining},\n"
            f" input_tokens_reset={self.input_tokens_reset},\n"
            f" output_tokens_remaining={self.output_tokens_remaining},\n"
            f" output_tokens_reset={self.output_tokens_reset},\n"
            f" retry_after={self.retry_after},\n"
            f" timestamp={self.timestamp})"
        )


class RateLimiter:
    most_recent_rate_limit_info: RateLimitInfo = None
    timestamp_rate_limit_info = None

    @staticmethod
    def update_anthropic_response(logger, headers: dict):
        RateLimiter.most_recent_rate_limit_info = RateLimitInfo.from_headers(headers)
        RateLimiter.timestamp_rate_limit_info = datetime.now(timezone.utc)
        # logger.debug(
        #     f"Updated rate limit info:\n {str(RateLimiter.most_recent_rate_limit_info).replace(',\n', ',')}"
        # )

    @staticmethod
    def should_wait_global(logger):
        if RateLimiter.most_recent_rate_limit_info is None:
            return False, 0
        return RateLimiter.most_recent_rate_limit_info.should_wait(logger)

    @staticmethod
    async def make_anthropic_request(
        logger,
        client,
        system_prompt,
        user_prompt,
        max_tokens=1000,
        temperature=0,
        messages=None,
    ):
        """Helper function to make Anthropic API requests with rate limiting and header handling"""
        should_wait, wait_time = RateLimiter.should_wait_global(logger)
        if should_wait:
            logger.info(f"Sleeping {wait_time}s before calling anthropic")
            await asyncio.sleep(wait_time)

        if messages is None:
            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": user_prompt,
                        }
                    ],
                }
            ]

        # Use create_raw to get access to headers
        raw_response = await client.messages.with_raw_response.create(
            model="claude-3-haiku-20240307",
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=messages,
        )

        # Extract rate limit headers
        ratelimit_requests_limit = raw_response.headers.get(
            "anthropic-ratelimit-requests-limit"
        )
        ratelimit_requests_remaining = raw_response.headers.get(
            "anthropic-ratelimit-requests-remaining"
        )
        # ratelimit_requests_reset = raw_response.headers.get(
        #     "anthropic-ratelimit-requests-reset"
        # )

        logger.info(
            f"Rate Limit Counts: {ratelimit_requests_remaining}/{ratelimit_requests_limit}"
        )
        # logger.info(f"Rate Limit Headers:")
        # logger.info(f"Requests Limit: {ratelimit_requests_limit}")
        # logger.info(f"Remaining Requests: {ratelimit_requests_remaining}")
        # logger.info(f"Reset Time: {ratelimit_requests_reset}")

        # Update rate limiter with headers from raw response
        RateLimiter.update_anthropic_response(logger, raw_response.headers)

        # Parse the response
        parsed_response = raw_response.parse()
        # logger.info(f"Parsed response is {parsed_response}")
        return parsed_response
