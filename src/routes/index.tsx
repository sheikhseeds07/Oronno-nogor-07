import { createFileRoute, Link, useRouteContext, useSuspenseQuery } from '@tanstack/react-router';
import { HomeSection } from '@tanstack/react-router';
import { Skeleton } from '/components/ui/skeleton';
import { homeQueryOptions } from '@/lib/home.functions';
import { CategorySection } from '../components/home/CategorySection';
import { BannerSection } from '../components/home/BannerSection';
import { FeaturedProductsSection } from '../components/home/FeaturedProductsSection';
import { NewArrivalsSection } from '../components/home/NewArrivalsSection';
import { SpecialOffersSection } from '../components/home/SpecialOffersSection';
import { MainLayout } from '../components/layout/MainLayout';

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(homeQueryOptions);
  },
  component: Home,
});

function Home() {
  const { data: homeData } = useSuspenseQuery(homeQueryOptions);

  return (
    <MainLayout>
      <div className="space-y-12 pb-16">
        <BannerSection banners={homeData.banners} />
        <CategorySection categories={homeQueryOptions.categories} />
        <FeaturedProductsSection products={homeQueryOptions.featuredProducts} />
        <NewArrivalsSection products={homeQueryOptions.newArrivals} />
        <SpecialOffersSection products={homeQueryOptions.specialOffers} />
      </div>
    </MainLayout>
  );
}
