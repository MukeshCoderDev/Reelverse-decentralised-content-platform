"""
Python Client for Decentralized Adult Platform API

This sample client demonstrates how to integrate with the platform API
for analytics, content search, and entitlement verification.
"""

import requests
import json
import hmac
import hashlib
import uuid
from typing import Dict, List, Optional, Any
from datetime import datetime


class PlatformAPIClient:
    """Python client for the Decentralized Adult Platform API"""
    
    def __init__(self, api_key: str, base_url: str = "https://api.platform.com/v1"):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })
    
    def _generate_correlation_id(self) -> str:
        """Generate correlation ID for request tracking"""
        return f"python-{str(uuid.uuid4())[:8]}"
    
    def _request(self, endpoint: str, method: str = 'GET', **kwargs) -> Dict[str, Any]:
        """Make authenticated API request"""
        url = f"{self.base_url}{endpoint}"
        headers = kwargs.pop('headers', {})
        headers['X-Correlation-ID'] = self._generate_correlation_id()
        
        response = self.session.request(method, url, headers=headers, **kwargs)
        
        try:
            data = response.json()
        except json.JSONDecodeError:
            raise Exception(f"Invalid JSON response: {response.text}")
        
        if not response.ok:
            error_msg = data.get('error', {}).get('message', 'Unknown error')
            raise Exception(f"API Error ({response.status_code}): {error_msg}")
        
        return data
    
    # Analytics Methods
    
    def get_analytics_overview(self, period: str = '24h') -> Dict[str, Any]:
        """Get analytics overview"""
        return self._request(f'/analytics/overview?period={period}')
    
    def get_revenue_metrics(self, start_date: Optional[str] = None, 
                          end_date: Optional[str] = None) -> Dict[str, Any]:
        """Get revenue metrics"""
        params = {}
        if start_date:
            params['startDate'] = start_date
        if end_date:
            params['endDate'] = end_date
        
        query_string = '&'.join([f'{k}={v}' for k, v in params.items()])
        endpoint = f'/analytics/revenue?{query_string}' if query_string else '/analytics/revenue'
        
        return self._request(endpoint)
    
    def get_content_performance(self, page: int = 1, limit: int = 20) -> Dict[str, Any]:
        """Get content performance metrics"""
        return self._request(f'/analytics/content/performance?page={page}&limit={limit}')
    
    def get_user_engagement(self, period: str = '24h') -> Dict[str, Any]:
        """Get user engagement metrics"""
        return self._request(f'/analytics/users/engagement?period={period}')
    
    def get_payout_metrics(self, page: int = 1, limit: int = 20) -> Dict[str, Any]:
        """Get payout metrics"""
        return self._request(f'/analytics/payouts?page={page}&limit={limit}')
    
    # Search Methods
    
    def search_content(self, query: str, search_type: str = 'hybrid', 
                      filters: Optional[Dict] = None, page: int = 1, 
                      limit: int = 20, include_metadata: bool = False) -> Dict[str, Any]:
        """Search content using hybrid search"""
        search_request = {
            'q': query,
            'type': search_type,
            'filters': filters or {},
            'page': page,
            'limit': limit,
            'includeMetadata': include_metadata
        }
        
        return self._request('/search/content', method='POST', json=search_request)
    
    def get_search_suggestions(self, query: str) -> Dict[str, Any]:
        """Get search suggestions"""
        return self._request(f'/search/suggestions?q={requests.utils.quote(query)}')
    
    def find_similar_content(self, content_id: str, limit: int = 10, 
                           threshold: float = 0.7) -> Dict[str, Any]:
        """Find similar content"""
        return self._request(f'/search/content/{content_id}/similar?limit={limit}&threshold={threshold}')
    
    def get_trending_content(self, period: str = '24h', limit: int = 20) -> Dict[str, Any]:
        """Get trending content"""
        return self._request(f'/search/trending?period={period}&limit={limit}')
    
    # Entitlement Methods
    
    def verify_entitlement(self, user_id: str, content_id: str, 
                         access_type: str = 'view') -> Dict[str, Any]:
        """Verify user entitlement for content"""
        request_data = {
            'userId': user_id,
            'contentId': content_id,
            'accessType': access_type
        }
        
        return self._request('/entitlements/verify', method='POST', json=request_data)
    
    def bulk_verify_entitlements(self, requests_list: List[Dict]) -> Dict[str, Any]:
        """Bulk verify entitlements"""
        return self._request('/entitlements/verify/bulk', method='POST', 
                           json={'requests': requests_list})
    
    def get_user_entitlements(self, user_id: str, page: int = 1, 
                            limit: int = 20, status: str = 'active') -> Dict[str, Any]:
        """Get user entitlements"""
        return self._request(f'/entitlements/user/{user_id}?page={page}&limit={limit}&status={status}')
    
    def get_content_stats(self, content_id: str) -> Dict[str, Any]:
        """Get content entitlement statistics"""
        return self._request(f'/entitlements/content/{content_id}/stats')
    
    # Webhook Methods
    
    def create_webhook_endpoint(self, url: str, events: List[str], 
                              retry_policy: Optional[Dict] = None) -> Dict[str, Any]:
        """Create webhook endpoint"""
        endpoint_data = {
            'url': url,
            'events': events,
            'retryPolicy': retry_policy or {
                'maxRetries': 3,
                'backoffMultiplier': 2,
                'maxBackoffSeconds': 300
            }
        }
        
        return self._request('/webhooks/endpoints', method='POST', json=endpoint_data)
    
    def get_webhook_endpoints(self) -> Dict[str, Any]:
        """Get webhook endpoints"""
        return self._request('/webhooks/endpoints')
    
    def get_webhook_endpoint(self, endpoint_id: str) -> Dict[str, Any]:
        """Get specific webhook endpoint"""
        return self._request(f'/webhooks/endpoints/{endpoint_id}')
    
    def update_webhook_endpoint(self, endpoint_id: str, updates: Dict) -> Dict[str, Any]:
        """Update webhook endpoint"""
        return self._request(f'/webhooks/endpoints/{endpoint_id}', method='PUT', json=updates)
    
    def delete_webhook_endpoint(self, endpoint_id: str) -> Dict[str, Any]:
        """Delete webhook endpoint"""
        return self._request(f'/webhooks/endpoints/{endpoint_id}', method='DELETE')
    
    def test_webhook_endpoint(self, endpoint_id: str, event_type: str, 
                            test_data: Optional[Dict] = None) -> Dict[str, Any]:
        """Test webhook endpoint"""
        test_request = {
            'eventType': event_type,
            'testData': test_data or {}
        }
        
        return self._request(f'/webhooks/endpoints/{endpoint_id}/test', 
                           method='POST', json=test_request)
    
    def get_webhook_events(self) -> Dict[str, Any]:
        """Get available webhook event types"""
        return self._request('/webhooks/events')


class WebhookVerifier:
    """Utility class for webhook signature verification"""
    
    def __init__(self, secret: str):
        self.secret = secret.encode('utf-8')
    
    def verify_signature(self, payload: str, signature: str) -> bool:
        """Verify webhook signature"""
        expected_signature = hmac.new(
            self.secret,
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected_signature)
    
    def generate_signature(self, payload: str) -> str:
        """Generate webhook signature for testing"""
        return hmac.new(
            self.secret,
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()


# Flask webhook handler example
def create_flask_webhook_handler(secret: str):
    """Create Flask webhook handler"""
    from flask import Flask, request, jsonify
    
    app = Flask(__name__)
    verifier = WebhookVerifier(secret)
    
    @app.route('/webhooks', methods=['POST'])
    def handle_webhook():
        # Verify signature
        signature = request.headers.get('X-Webhook-Signature')
        payload = request.get_data(as_text=True)
        
        if not verifier.verify_signature(payload, signature):
            return jsonify({'error': 'Invalid signature'}), 401
        
        # Process webhook
        data = request.get_json()
        event_type = data.get('type')
        event_data = data.get('data')
        
        if event_type == 'purchase.completed':
            print(f"Purchase completed: {event_data}")
            # Handle purchase completion
        elif event_type == 'content.uploaded':
            print(f"Content uploaded: {event_data}")
            # Handle new content
        elif event_type == 'payout.processed':
            print(f"Payout processed: {event_data}")
            # Handle payout
        else:
            print(f"Unknown event type: {event_type}")
        
        return jsonify({'received': True})
    
    return app


# Usage examples
def main():
    """Example usage of the API client"""
    client = PlatformAPIClient('your-api-key-here')
    
    try:
        # Get analytics overview
        overview = client.get_analytics_overview('7d')
        print("Analytics Overview:", overview['data'])
        
        # Search for content
        search_results = client.search_content(
            'fitness workout',
            search_type='hybrid',
            filters={
                'category': 'fitness',
                'minDuration': 300
            },
            limit=10
        )
        print("Search Results:", len(search_results['data']['results']['items']))
        
        # Verify entitlement
        entitlement = client.verify_entitlement(
            'user-uuid',
            'content-uuid',
            'stream'
        )
        print("Has Access:", entitlement['data']['hasAccess'])
        
        # Create webhook endpoint
        webhook = client.create_webhook_endpoint(
            'https://your-app.com/webhooks',
            ['purchase.completed', 'content.uploaded']
        )
        print("Webhook Created:", webhook['data']['id'])
        
        # Get trending content
        trending = client.get_trending_content('24h', 5)
        print("Trending Content:", len(trending['data']['trending']))
        
    except Exception as e:
        print(f"Error: {e}")


if __name__ == '__main__':
    main()