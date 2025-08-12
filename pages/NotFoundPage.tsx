
import React from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/shared/EmptyState';
import Button from '../components/Button';

const NotFoundPage: React.FC = () => {
    return (
        <div className="p-6">
             <EmptyState 
                icon="slash-circle"
                title="404 - Page Not Found" 
                subtitle="Sorry, the page you are looking for does not exist." 
            />
            <div className="text-center mt-4">
                <Link to="/">
                    <Button>Go to Home</Button>
                </Link>
            </div>
        </div>
    );
};

export default NotFoundPage;
