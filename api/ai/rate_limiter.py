from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
import asyncio
import logging
import os
import time


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
        request_start_time = datetime.now(timezone.utc)
        logger.info(f"Starting Anthropic API request at {request_start_time.isoformat()}")
        
        # Check rate limits before making request
        should_wait, wait_time = RateLimiter.should_wait_global(logger)
        if should_wait:
            logger.warning(f"Rate limit reached. Sleeping {wait_time:.2f}s before calling Anthropic API")
            await asyncio.sleep(wait_time)
            logger.info(f"Resuming after rate limit wait of {wait_time:.2f}s")

        # Prepare messages
        if messages is None:
            logger.info(f"Creating message with system prompt ({len(system_prompt)} chars) and user prompt ({len(user_prompt)} chars)")
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
        else:
            logger.info(f"Using provided messages array with {len(messages)} messages")

        # Get model from environment variable or use default
        model = os.getenv("CLAUDE_MODEL", "claude-3-5-haiku-20241022")
        logger.info(f"Using Anthropic model: {model}")
        logger.info(f"Request parameters: max_tokens={max_tokens}, temperature={temperature}")
        
        # Track retry attempts
        retry_count = 0
        max_retries = 5  # We'll log this but not enforce it yet
        
        try:
            # Use create_raw to get access to headers
            logger.info("Sending request to Anthropic API...")
            api_call_start = time.time()
            
            raw_response = await client.messages.with_raw_response.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt,
                messages=messages,
            )
            
            api_call_duration = time.time() - api_call_start
            logger.info(f"Anthropic API raw response received in {api_call_duration:.2f} seconds")

            # Extract rate limit headers
            ratelimit_requests_limit = raw_response.headers.get(
                "anthropic-ratelimit-requests-limit"
            )
            ratelimit_requests_remaining = raw_response.headers.get(
                "anthropic-ratelimit-requests-remaining"
            )
            ratelimit_requests_reset = raw_response.headers.get(
                "anthropic-ratelimit-requests-reset"
            )
            
            # Log all headers for debugging
            logger.info("Anthropic API response headers:")
            for header, value in raw_response.headers.items():
                if header.startswith("anthropic-"):
                    logger.info(f"  {header}: {value}")

            logger.info(
                f"Rate Limit Status: {ratelimit_requests_remaining}/{ratelimit_requests_limit} requests remaining"
            )
            logger.info(f"Rate Limit Reset: {ratelimit_requests_reset}")

            # Update rate limiter with headers from raw response
            RateLimiter.update_anthropic_response(logger, raw_response.headers)

            # Parse the response
            logger.info("Parsing Anthropic API response...")
            parse_start = time.time()
            parsed_response = raw_response.parse()
            parse_duration = time.time() - parse_start
            logger.info(f"Response parsed in {parse_duration:.2f} seconds")
            
            # Log response structure (without content)
            if hasattr(parsed_response, 'id'):
                logger.info(f"Response ID: {parsed_response.id}")
            if hasattr(parsed_response, 'model'):
                logger.info(f"Response Model: {parsed_response.model}")
            if hasattr(parsed_response, 'content') and parsed_response.content:
                logger.info(f"Response has {len(parsed_response.content)} content blocks")
                
            total_duration = time.time() - api_call_start
            logger.info(f"Total Anthropic API request completed in {total_duration:.2f} seconds")
            
            return parsed_response
            
        except Exception as e:
            retry_count += 1
            error_time = time.time() - api_call_start
            logger.error(f"Anthropic API request failed after {error_time:.2f} seconds on attempt {retry_count}/{max_retries}")
            logger.error(f"Error type: {type(e).__name__}")
            logger.error(f"Error message: {str(e)}")
            
            # Log detailed error information
            if hasattr(e, 'status_code'):
                logger.error(f"HTTP Status Code: {e.status_code}")
            if hasattr(e, 'headers'):
                logger.error(f"Error response headers: {e.headers}")
            if hasattr(e, 'response') and hasattr(e.response, 'text'):
                logger.error(f"Error response body: {e.response.text[:500]}...")
                
            # Check for specific error types
            if "connection" in str(e).lower() or "timeout" in str(e).lower():
                logger.error("Network connectivity issue detected")
            if "rate limit" in str(e).lower() or "429" in str(e):
                logger.error("Rate limiting issue detected")
            if "authentication" in str(e).lower() or "401" in str(e):
                logger.error("Authentication issue detected - check API key")
                
            # Re-raise the exception
            raise
