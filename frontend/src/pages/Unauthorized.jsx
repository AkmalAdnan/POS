import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9F6F0] p-6">
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-brand-500">403</div>
        <h1 className="font-heading text-4xl mt-2">Not for your role</h1>
        <p className="text-brand-900/60 mt-2 max-w-md">Your account doesn't have access to this page. Please sign in with an account that does.</p>
        <Button asChild className="mt-6 bg-brand-500 hover:bg-brand-600 text-white" data-testid="unauth-back-btn">
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
