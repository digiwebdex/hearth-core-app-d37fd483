import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import PublicLayout from "@/components/PublicLayout";
import { useWebsite } from "@/contexts/WebsiteContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { publicApi, type BlogPostPublic } from "@/lib/publicApi";
import { ArrowLeft, Calendar, User } from "lucide-react";

const SiteBlog = () => {
  const { tenant, domainResolution } = useWebsite();
  const { postSlug } = useParams<{ postSlug?: string }>();
  const [posts, setPosts] = useState<BlogPostPublic[]>([]);
  const [post, setPost] = useState<BlogPostPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isTenantHost =
    domainResolution?.type === "slug" || domainResolution?.type === "custom-domain";
  const blogBase = isTenantHost ? "/blog" : "/site/blog";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const load = async () => {
      try {
        if (postSlug) {
          const single = await publicApi.getBlogPost(tenant.slug, postSlug);
          if (!cancelled) setPost(single);
        } else {
          const list = await publicApi.getBlogPosts(tenant.slug);
          if (!cancelled) setPosts(list);
        }
      } catch {
        if (!cancelled) setError("Failed to load blog posts.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [tenant.slug, postSlug]);

  if (postSlug && post) {
    return (
      <PublicLayout>
        <article className="py-12">
          <div className="container mx-auto px-4 max-w-3xl">
            <Link to={blogBase}>
              <Button variant="ghost" size="sm" className="mb-6">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to blog
              </Button>
            </Link>
            {post.coverImage ? (
              <img
                src={post.coverImage}
                alt={post.title}
                className="w-full rounded-lg mb-8 max-h-80 object-cover"
              />
            ) : null}
            <h1 className="text-4xl font-extrabold tracking-tight mb-4">{post.title}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-8">
              {post.publishedAt ? (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(post.publishedAt), "PPP")}
                </span>
              ) : null}
              {post.authorName ? (
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {post.authorName}
                </span>
              ) : null}
            </div>
            <div className="prose prose-neutral dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed">
              {post.body || post.excerpt}
            </div>
          </div>
        </article>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <section className="bg-primary/5 py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight mb-4">Travel Blog</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tips, updates, and stories from {tenant.name}.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          {loading ? (
            <p className="text-center text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="text-center text-destructive">{error}</p>
          ) : posts.length === 0 ? (
            <p className="text-center text-muted-foreground">No posts published yet.</p>
          ) : (
            <div className="grid gap-6">
              {posts.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-0 sm:flex">
                    {item.coverImage ? (
                      <img
                        src={item.coverImage}
                        alt={item.title}
                        className="sm:w-48 h-40 sm:h-auto object-cover shrink-0"
                      />
                    ) : null}
                    <div className="p-6 flex-1">
                      <h2 className="text-xl font-bold mb-2">
                        <Link to={`${blogBase}/${item.slug}`} className="hover:text-primary">
                          {item.title}
                        </Link>
                      </h2>
                      {item.publishedAt ? (
                        <p className="text-xs text-muted-foreground mb-3">
                          {format(new Date(item.publishedAt), "PPP")}
                        </p>
                      ) : null}
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-3">{item.excerpt}</p>
                      <Link to={`${blogBase}/${item.slug}`}>
                        <Button variant="outline" size="sm">
                          Read more
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
};

export default SiteBlog;
